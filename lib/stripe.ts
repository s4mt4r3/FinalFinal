// ============================================================
// lib/stripe.ts
// ============================================================
// Server-only Stripe client. Reads credentials from env so the
// secret key never reaches the browser.
//
// Required env vars:
//   STRIPE_SECRET_KEY     — sk_live_... or sk_test_...
//   STRIPE_PRICE_ID       — the price ID for the Plus product
//   STRIPE_WEBHOOK_SECRET — whsec_... from the webhook endpoint
//   NEXT_PUBLIC_APP_URL   — e.g. https://finalfinal.app (used for Stripe redirects)
// ============================================================

import Stripe from 'stripe';

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  cached = new Stripe(key, {
    // Pinning a version means a future Stripe API change doesn't silently
    // alter our behavior. Bump intentionally.
    apiVersion: '2025-09-30.clover',
    typescript: true,
  });
  return cached;
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}
