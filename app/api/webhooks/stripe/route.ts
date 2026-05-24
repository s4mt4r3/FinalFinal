// ============================================================
// app/api/webhooks/stripe/route.ts
// ============================================================
//   POST /api/webhooks/stripe
//   Stripe → our server. Signature-verified, then mirrors
//   subscription state into the `subscriptions` table.
//
//   Configure the endpoint in Stripe Dashboard → Developers →
//   Webhooks, listening for:
//     - checkout.session.completed
//     - customer.subscription.created
//     - customer.subscription.updated
//     - customer.subscription.deleted
//
//   And copy the signing secret into STRIPE_WEBHOOK_SECRET.
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, requireEnv } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Next.js App Router note: by default it parses the body. The Stripe
// signature is computed on the raw bytes, so we have to grab them
// ourselves before any framework parsing.
export const runtime = 'nodejs';

type SubStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';

function mapStatus(s: Stripe.Subscription.Status): SubStatus {
  switch (s) {
    case 'active':
    case 'trialing':
    case 'past_due':
    case 'canceled':
    case 'incomplete':
      return s;
    case 'unpaid':
    case 'incomplete_expired':
      return 'canceled';
    case 'paused':
      return 'past_due';
    default:
      return 'incomplete';
  }
}

async function upsertFromSubscription(sub: Stripe.Subscription) {
  const admin = getSupabaseAdmin();
  const userId =
    (sub.metadata?.supabase_user_id as string | undefined) ??
    (await lookupUserIdByCustomer(sub.customer));

  if (!userId) {
    console.error('[stripe webhook] no supabase_user_id for subscription', sub.id);
    return;
  }

  const isPlus =
    sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due';

  // Subscription period end is on the first item, not the subscription itself,
  // in the current Stripe API shape. Fall back gracefully.
  const periodEndUnix =
    (sub.items?.data?.[0] as { current_period_end?: number } | undefined)
      ?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    null;

  await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      tier: isPlus ? 'plus' : 'free',
      status: mapStatus(sub.status),
      current_period_end: periodEndUnix
        ? new Date(periodEndUnix * 1000).toISOString()
        : null,
    } as never,
    { onConflict: 'user_id' }
  );
}

async function lookupUserIdByCustomer(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer
): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const customerId = typeof customer === 'string' ? customer : customer.id;
  const { data } = await admin
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return (data as { user_id?: string } | null)?.user_id ?? null;
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    const secret = requireEnv('STRIPE_WEBHOOK_SECRET');
    const raw = await req.text();
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error('[stripe webhook] signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          await upsertFromSubscription(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await upsertFromSubscription(sub);
        break;
      }
      default:
        // Other events (invoice.*, etc.) — ignore. We could log here.
        break;
    }
  } catch (err) {
    console.error('[stripe webhook] handler error:', err);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
