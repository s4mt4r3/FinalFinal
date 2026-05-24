// ============================================================
// app/api/billing/portal/route.ts
// ============================================================
//   POST /api/billing/portal
//   Returns a Stripe Customer Portal URL so the user can
//   manage payment methods, cancel, or update their plan.
// ============================================================

import { NextResponse } from 'next/server';
import { route } from '@/lib/api-helpers';
import { getStripe, requireEnv } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const POST = route(async ({ user }) => {
  const stripe = getStripe();
  const appUrl = requireEnv('NEXT_PUBLIC_APP_URL');
  const admin = getSupabaseAdmin();

  const { data } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  const customerId = (data as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json(
      { error: 'No active subscription to manage' },
      { status: 404 }
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/`,
  });

  return NextResponse.json({ url: session.url });
});
