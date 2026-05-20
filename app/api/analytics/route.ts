// ============================================================
// app/api/analytics/route.ts
// ============================================================
//   GET /api/analytics  → callback rates per resume version,
//                          plus overall totals.
//
// Reads from the version_stats view we built in 0004_analytics_view.sql.
// All the math (counts, rates) is done by Postgres, so this route
// is a thin pass-through.
// ============================================================

import { NextResponse } from 'next/server';
import { route } from '@/lib/api-helpers';

export const GET = route(async ({ supabase }) => {
  const [statsRes, appsRes] = await Promise.all([
    supabase
      .from('version_stats')
      .select('*')
      .order('callback_rate_pct', { ascending: false }),
    supabase.from('applications').select('status'),
  ]);

  if (statsRes.error) throw statsRes.error;
  if (appsRes.error) throw appsRes.error;

  const apps = appsRes.data;
  const total = apps.length;
  const callbacks = apps.filter(
    (a) => a.status === 'interviewing' || a.status === 'offer'
  ).length;
  const offers = apps.filter((a) => a.status === 'offer').length;

  return NextResponse.json({
    overall: {
      total_applications: total,
      callbacks,
      offers,
      callback_rate_pct: total > 0 ? Math.round((callbacks / total) * 100) : 0,
    },
    by_version: statsRes.data,
  });
});
