// ============================================================
// app/api/resumes/route.ts
// ============================================================
//   GET  /api/resumes        → list all your resumes
//   POST /api/resumes        → create a new resume version
// ============================================================

import { NextResponse } from 'next/server';
import { route, ResumeCreateSchema } from '@/lib/api-helpers';

// ------------------------------------------------------------
// GET /api/resumes
// ------------------------------------------------------------
// Returns every resume the current user owns, newest first.
// RLS guarantees we can't accidentally return someone else's.
// ------------------------------------------------------------
export const GET = route(async ({ supabase }) => {
  const { data, error } = await supabase
    .from('resumes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return NextResponse.json({ resumes: data });
});

// ------------------------------------------------------------
// POST /api/resumes
// ------------------------------------------------------------
// Body: { name, content?, parent_id?, tags?, notes? }
// ------------------------------------------------------------
export const POST = route(async ({ supabase, user, request }) => {
  const body = await request.json();
  const input = ResumeCreateSchema.parse(body); // throws ZodError on invalid

  const { data, error } = await supabase
    .from('resumes')
    .insert({
      user_id: user.id,
      name: input.name,
      content: input.content,
      parent_id: input.parent_id ?? null,
      tags: input.tags,
      notes: input.notes,
      source_file_path: input.source_file_path ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return NextResponse.json({ resume: data }, { status: 201 });
});
