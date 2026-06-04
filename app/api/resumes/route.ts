// ============================================================
// app/api/resumes/route.ts
// ============================================================
//   GET  /api/resumes   → list all your composed resumes
//   POST /api/resumes   → create a resume from a section composition
//
// A resume is now a composition: name/tags/notes plus an ordered
// list of section-variant ids. We persist the join rows and a
// rendered plain-text cache (resumes.content) in one shot.
// ============================================================

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { route, ResumeCreateSchema } from '@/lib/api-helpers';
import { setComposition } from '@/lib/compose';

export const GET = route(async ({ supabase }) => {
  const { data, error } = await supabase
    .from('resumes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return NextResponse.json({ resumes: data });
});

export const POST = route(async ({ supabase, user, request }) => {
  const sb = supabase as SupabaseClient<any, any, any>;
  const body = await request.json();
  const input = ResumeCreateSchema.parse(body);

  // 1. Create the resume shell.
  const { data: resume, error } = await sb
    .from('resumes')
    .insert({
      user_id: user.id,
      name: input.name,
      content: '',
      parent_id: null,
      tags: input.tags,
      notes: input.notes,
    })
    .select()
    .single();

  if (error || !resume) throw error ?? new Error('Failed to create resume');

  // 2. Attach the composition (and render the content cache).
  const variants = await setComposition(sb, resume.id, input.sections ?? []);

  return NextResponse.json(
    { resume: { ...resume, sections: variants } },
    { status: 201 }
  );
});
