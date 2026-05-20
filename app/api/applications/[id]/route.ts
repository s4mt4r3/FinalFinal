// ============================================================
// app/api/applications/[id]/route.ts
// ============================================================
//   PATCH  /api/applications/:id   → update status, notes, etc.
//   DELETE /api/applications/:id   → remove the application
// ============================================================

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { route, ApplicationUpdateSchema } from '@/lib/api-helpers';

const IdSchema = z.string().uuid();

export const PATCH = route(async ({ supabase, params, request }) => {
  const id = IdSchema.parse(params.id);
  const body = await request.json();
  const patch = ApplicationUpdateSchema.parse(body);

  const { data, error } = await supabase
    .from('applications')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return NextResponse.json({ application: data });
});

export const DELETE = route(async ({ supabase, params }) => {
  const id = IdSchema.parse(params.id);

  const { error } = await supabase.from('applications').delete().eq('id', id);
  if (error) throw error;

  return NextResponse.json({ success: true });
});
