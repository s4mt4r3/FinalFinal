// ============================================================
// app/api/resumes/[id]/route.ts
// ============================================================
//   GET    /api/resumes/:id   → fetch one resume (with children)
//   PATCH  /api/resumes/:id   → update name/content/tags/notes
//   DELETE /api/resumes/:id   → delete (cascades to children)
//
// The :id segment becomes params.id, validated as a uuid below.
// ============================================================

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { route, ResumeUpdateSchema } from '@/lib/api-helpers';

const IdSchema = z.string().uuid();

// ------------------------------------------------------------
// GET /api/resumes/:id
// ------------------------------------------------------------
// Returns the resume plus its direct children (one tree level
// down). The frontend assembles the full tree from the list
// endpoint, but this is handy for the detail view.
// ------------------------------------------------------------
export const GET = route(async ({ supabase, params }) => {
  const id = IdSchema.parse(params.id);

  const [resumeRes, childrenRes, appsRes] = await Promise.all([
    supabase.from('resumes').select('*').eq('id', id).single(),
    supabase.from('resumes').select('*').eq('parent_id', id),
    supabase.from('applications').select('*').eq('resume_id', id),
  ]);

  if (resumeRes.error) {
    // RLS makes "not yours" look identical to "not found" — by design.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    resume: resumeRes.data,
    children: childrenRes.data ?? [],
    applications: appsRes.data ?? [],
  });
});

// ------------------------------------------------------------
// PATCH /api/resumes/:id
// ------------------------------------------------------------
// Partial update. Send only the fields you want to change.
// ------------------------------------------------------------
export const PATCH = route(async ({ supabase, params, request }) => {
  const id = IdSchema.parse(params.id);
  const body = await request.json();
  const patch = ResumeUpdateSchema.parse(body);

  // Disallow re-parenting to your own descendant (would create a cycle).
  if (patch.parent_id) {
    if (patch.parent_id === id) {
      return NextResponse.json(
        { error: 'A resume cannot be its own parent' },
        { status: 400 }
      );
    }
    // Walk up from the proposed parent — if we hit `id`, it's a cycle.
    let cursor: string | null = patch.parent_id;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      if (cursor === id) {
        return NextResponse.json(
          { error: 'Would create a cycle in the version tree' },
          { status: 400 }
        );
      }
      const { data } = await supabase
        .from('resumes')
        .select('parent_id')
        .eq('id', cursor)
        .single();
      cursor = data?.parent_id ?? null;
    }
  }

  const { data, error } = await supabase
    .from('resumes')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return NextResponse.json({ resume: data });
});

// ------------------------------------------------------------
// DELETE /api/resumes/:id
// ------------------------------------------------------------
// Postgres cascades to children (ON DELETE CASCADE in the schema),
// so deleting the master also removes everything branched from it.
// Applications linked to deleted resumes get their resume_id set
// to null (preserving the application record).
// ------------------------------------------------------------
export const DELETE = route(async ({ supabase, params }) => {
  const id = IdSchema.parse(params.id);

  const { error } = await supabase.from('resumes').delete().eq('id', id);
  if (error) throw error;

  return NextResponse.json({ success: true });
});
