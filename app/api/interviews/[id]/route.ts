// ============================================================
// app/api/interviews/[id]/route.ts
// ============================================================
//   PATCH  /api/interviews/:id   → update fields
//   DELETE /api/interviews/:id   → remove
// ============================================================

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { route } from '@/lib/api-helpers';

const IdSchema = z.string().uuid();

const UpdateSchema = z.object({
  scheduled_at: z.string().datetime().nullable().optional(),
  kind: z.string().trim().min(1).max(40).nullable().optional(),
  notes: z.string().max(5000).optional(),
  outcome: z.enum(['pending', 'passed', 'rejected', 'withdrew']).nullable().optional(),
});

export const PATCH = route(async ({ supabase, params, request }) => {
  const id = IdSchema.parse(params.id);
  const body = await request.json();
  const patch = UpdateSchema.parse(body) as never;

  const { data, error } = await supabase
    .from('interviews')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return NextResponse.json({ interview: data });
});

export const DELETE = route(async ({ supabase, params }) => {
  const id = IdSchema.parse(params.id);
  const { error } = await supabase.from('interviews').delete().eq('id', id);
  if (error) throw error;
  return NextResponse.json({ success: true });
});
