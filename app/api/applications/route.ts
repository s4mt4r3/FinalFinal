// ============================================================
// app/api/applications/route.ts
// ============================================================
//   GET  /api/applications        → list with optional filters
//   POST /api/applications        → track a new application
// ============================================================

import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  route,
  ApplicationCreateSchema,
  ApplicationStatusSchema,
} from '@/lib/api-helpers';

// ------------------------------------------------------------
// GET /api/applications
// ------------------------------------------------------------
// Query params:
//   ?status=interviewing  (filter by status)
//   ?resume_id=<uuid>     (only apps using this resume)
//   ?search=<text>        (company/role contains)
// ------------------------------------------------------------
const ListQuerySchema = z.object({
  status: ApplicationStatusSchema.optional(),
  resume_id: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
});

export const GET = route(async ({ supabase, request }) => {
  const url = new URL(request.url);
  const q = ListQuerySchema.parse({
    status: url.searchParams.get('status') ?? undefined,
    resume_id: url.searchParams.get('resume_id') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
  });

  let query = supabase
    .from('applications')
    .select('*')
    .order('date_applied', { ascending: false });

  if (q.status) query = query.eq('status', q.status);
  if (q.resume_id) query = query.eq('resume_id', q.resume_id);
  if (q.search) {
    // ilike = case-insensitive LIKE. % is the wildcard.
    query = query.or(`company.ilike.%${q.search}%,role.ilike.%${q.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return NextResponse.json({ applications: data });
});

// ------------------------------------------------------------
// POST /api/applications
// ------------------------------------------------------------
export const POST = route(async ({ supabase, user, request }) => {
  const body = await request.json();
  const input = ApplicationCreateSchema.parse(body);

  const { data, error } = await supabase
    .from('applications')
    .insert({
      user_id: user.id,
      company: input.company,
      role: input.role ?? null,
      resume_id: input.resume_id ?? null,
      status: input.status,
      notes: input.notes,
      date_applied: input.date_applied ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return NextResponse.json({ application: data }, { status: 201 });
});
