// ============================================================
// lib/billing.ts
// ============================================================
// Feature gating for Plus-only routes. The real check (against
// a Stripe-backed subscriptions table) is wired up in the
// billing step; until then these helpers permit all access so
// the Plus features can be developed and tested locally.
//
// Use at the top of every Plus-only route:
//
//   import { requirePlus } from '@/lib/billing';
//   await requirePlus(supabase, user.id);
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export type Tier = 'free' | 'plus';

export class PlusRequiredError extends Error {
  status = 402;
  constructor(message = 'Plus subscription required') {
    super(message);
    this.name = 'PlusRequiredError';
  }
}

export async function getTier(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<Tier> {
  try {
    const { data } = await (supabase as SupabaseClient)
      .from('subscriptions')
      .select('tier, status')
      .eq('user_id', userId)
      .maybeSingle();

    const row = data as { tier?: string; status?: string } | null;
    if (!row) return 'free';
    if (row.tier === 'plus' && (row.status === 'active' || row.status === 'trialing')) {
      return 'plus';
    }
    return 'free';
  } catch {
    // Subscriptions table not migrated yet — fall through to free.
    return 'free';
  }
}

export async function isPlus(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  if (process.env.FF_PLUS_DEV_BYPASS === 'true') return true;
  return (await getTier(supabase, userId)) === 'plus';
}

export async function requirePlus(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  if (!(await isPlus(supabase, userId))) {
    throw new PlusRequiredError();
  }
}
