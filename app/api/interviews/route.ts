// ============================================================
// app/api/interviews/route.ts
// ============================================================
//   GET  /api/interviews?application_id=<uuid>?  → list
//   POST /api/interviews                          → create
// ============================================================

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { route } from '@/lib/api-helpers';
import { requirePlus } from '@/lib/billing';

const InterviewKindSchema = z.string().trim().min(1).max(40).optional().nullable();
const InterviewOutcomeSchema = z
  .enum(['pending', 'passed', 'rejected', 'withdrew'])
  .optional()
  .nullable();

const CreateSchema = z.object({
  application_id: z.string().uuid(),
  scheduled_at: z.string().datetime().nullable().optional(),
  kind: InterviewKindSchema,
  notes: z.string().max(5000).default(''),
  outcome: InterviewOutcomeSchema,
});

export const GET = route(async ({ supabase, user, request }) => {
  await requirePlus(supabase, user.id);

  const url = new URL(request.url);
  const application_id = url.searchParams.get('application_id') ?? undefined;

  let query = supabase
    .from('interviews')
    .select('*')
    .order('scheduled_at', { ascending: true });
  if (application_id) {
    z.string().uuid().parse(application_id);
    query = query.eq('application_id', application_id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return NextResponse.json({ interviews: data });
});

export const POST = route(async ({ supabase, user, request }) => {
  await requirePlus(supabase, user.id);

  const body = await request.json();
  const input = CreateSchema.parse(body);

  const insertRow = {
    user_id: user.id,
    application_id: input.application_id,
    scheduled_at: input.scheduled_at ?? null,
    kind: input.kind ?? null,
    notes: input.notes,
    outcome: input.outcome ?? null,
  } as never;

  const { data, error } = await supabase
    .from('interviews')
    .insert(insertRow)
    .select()
    .single();

  if (error) throw error;
  return NextResponse.json({ interview: data }, { status: 201 });
});
