// ============================================================
// app/api/billing/checkout/route.ts
// ============================================================
//   POST /api/billing/checkout
//   Creates (or reuses) a Stripe customer for this user and
//   returns a Checkout Session URL for the Plus subscription.
// ============================================================

import { NextResponse } from 'next/server';
import { route } from '@/lib/api-helpers';
import { getStripe, requireEnv } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const POST = route(async ({ user }) => {
  const stripe = getStripe();
  const priceId = requireEnv('STRIPE_PRICE_ID');
  const appUrl = requireEnv('NEXT_PUBLIC_APP_URL');
  const admin = getSupabaseAdmin();

  // Reuse an existing Stripe customer if we already have one for this user.
  const { data: existing } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  let customerId: string | undefined =
    (existing as { stripe_customer_id?: string | null } | null)?.stripe_customer_id ?? undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await admin.from('subscriptions').upsert(
      {
        user_id: user.id,
        stripe_customer_id: customerId,
        tier: 'free',
        status: 'incomplete',
      } as never,
      { onConflict: 'user_id' }
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/?billing=success`,
    cancel_url: `${appUrl}/?billing=cancel`,
    subscription_data: {
      trial_period_days: 14,
      metadata: { supabase_user_id: user.id },
    },
    metadata: { supabase_user_id: user.id },
    allow_promotion_codes: true,
  });

  if (!session.url) {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
  return NextResponse.json({ url: session.url });
});
