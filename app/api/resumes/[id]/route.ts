// ============================================================
// app/api/resumes/[id]/route.ts
// ============================================================
//   GET    /api/resumes/:id   → resume + its composed section variants
//   PATCH  /api/resumes/:id   → update name/tags/notes and/or sections
//   DELETE /api/resumes/:id   → delete (cascades resume_sections)
// ============================================================

import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { route, ResumeUpdateSchema } from '@/lib/api-helpers';
import { getComposition, setComposition } from '@/lib/compose';

const IdSchema = z.string().uuid();

export const GET = route(async ({ supabase, params }) => {
  const sb = supabase as SupabaseClient<any, any, any>;
  const id = IdSchema.parse(params.id);

  const [resumeRes, appsRes] = await Promise.all([
    sb.from('resumes').select('*').eq('id', id).single(),
    sb.from('applications').select('*').eq('resume_id', id),
  ]);

  if (resumeRes.error || !resumeRes.data) {
    // RLS makes "not yours" look identical to "not found" — by design.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const sections = await getComposition(sb, id);

  return NextResponse.json({
    resume: { ...resumeRes.data, sections },
    applications: appsRes.data ?? [],
  });
});

export const PATCH = route(async ({ supabase, params, request }) => {
  const sb = supabase as SupabaseClient<any, any, any>;
  const id = IdSchema.parse(params.id);
  const body = await request.json();
  const patch = ResumeUpdateSchema.parse(body);

  // Metadata fields go straight onto the row.
  const meta: Record<string, unknown> = {};
  if (patch.name !== undefined) meta.name = patch.name;
  if (patch.tags !== undefined) meta.tags = patch.tags;
  if (patch.notes !== undefined) meta.notes = patch.notes;

  if (Object.keys(meta).length > 0) {
    const { error } = await sb.from('resumes').update(meta).eq('id', id);
    if (error) throw error;
  }

  // If a new composition was supplied, replace it (this also
  // regenerates the content cache).
  let sections;
  if (patch.sections !== undefined) {
    sections = await setComposition(sb, id, patch.sections);
  } else {
    sections = await getComposition(sb, id);
  }

  const { data: resume, error: rErr } = await sb
    .from('resumes')
    .select('*')
    .eq('id', id)
    .single();
  if (rErr || !resume) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ resume: { ...resume, sections } });
});

export const DELETE = route(async ({ supabase, params }) => {
  const id = IdSchema.parse(params.id);
  const { error } = await supabase.from('resumes').delete().eq('id', id);
  if (error) throw error;
  return NextResponse.json({ success: true });
});
