// ============================================================
// app/api/billing/status/route.ts
// ============================================================
//   GET /api/billing/status
//   Returns the user's tier and current period end so the UI
//   can render "Plus" badges and upgrade CTAs.
// ============================================================

import { NextResponse } from 'next/server';
import { route } from '@/lib/api-helpers';
import { getTier } from '@/lib/billing';

export const GET = route(async ({ supabase, user }) => {
  const tier = await getTier(supabase, user.id);

  const { data } = await supabase
    .from('subscriptions')
    .select('current_period_end, status')
    .eq('user_id', user.id)
    .maybeSingle();

  const row = data as { current_period_end?: string | null; status?: string } | null;

  return NextResponse.json({
    tier,
    status: row?.status ?? null,
    current_period_end: row?.current_period_end ?? null,
  });
});
