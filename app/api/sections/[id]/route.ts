// ============================================================
// app/api/sections/[id]/route.ts
// ============================================================
//   PATCH  /api/sections/:id   → update a variant's label / data
//   DELETE /api/sections/:id   → delete a variant (cascades out of
//                                any resume composition that used it)
// ============================================================

import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { route, SectionUpdateSchema } from '@/lib/api-helpers';
import { getComposition, regenerateContent } from '@/lib/compose';

const IdSchema = z.string().uuid();

export const PATCH = route(async ({ supabase, params, request }) => {
  const sb = supabase as SupabaseClient<any, any, any>;
  const id = IdSchema.parse(params.id);
  const body = await request.json();
  const patch = SectionUpdateSchema.parse(body);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await sb
    .from('section_variants')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Editing a variant's content changes every resume that includes
  // it — refresh those resumes' text caches so search/export stay
  // accurate.
  if (patch.data !== undefined) {
    const { data: joins } = await sb
      .from('resume_sections')
      .select('resume_id')
      .eq('variant_id', id);
    const resumeIds = Array.from(
      new Set(((joins ?? []) as { resume_id: string }[]).map((j) => j.resume_id))
    );
    for (const rid of resumeIds) {
      const variants = await getComposition(sb, rid);
      await regenerateContent(sb, rid, variants);
    }
  }

  return NextResponse.json({ variant: data });
});

export const DELETE = route(async ({ supabase, params }) => {
  const sb = supabase as SupabaseClient<any, any, any>;
  const id = IdSchema.parse(params.id);

  // Which resumes will be affected once this variant is removed?
  const { data: joins } = await sb
    .from('resume_sections')
    .select('resume_id')
    .eq('variant_id', id);
  const resumeIds = Array.from(
    new Set(((joins ?? []) as { resume_id: string }[]).map((j) => j.resume_id))
  );

  const { error } = await sb.from('section_variants').delete().eq('id', id);
  if (error) throw error;

  // The join rows cascaded away; refresh affected resumes' caches.
  for (const rid of resumeIds) {
    const variants = await getComposition(sb, rid);
    await regenerateContent(sb, rid, variants);
  }

  return NextResponse.json({ success: true });
});
