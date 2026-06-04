// ============================================================
// app/api/sections/route.ts
// ============================================================
//   GET  /api/sections?kind=experience  → list your section variants
//   POST /api/sections                  → create a variant
//
// Section variants are the reusable, versioned building blocks of
// a resume. "Branching" lives here: many variants per section kind,
// mixed and matched into a tailored resume by the builder.
// ============================================================

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { route, SectionCreateSchema, SectionKindSchema } from '@/lib/api-helpers';

export const GET = route(async ({ supabase, request }) => {
  const sb = supabase as SupabaseClient<any, any, any>;
  const url = new URL(request.url);
  const kindParam = url.searchParams.get('kind');

  let query = sb
    .from('section_variants')
    .select('*')
    .order('kind', { ascending: true })
    .order('created_at', { ascending: false });

  if (kindParam) {
    const kind = SectionKindSchema.parse(kindParam);
    query = query.eq('kind', kind);
  }

  const { data, error } = await query;
  if (error) throw error;
  return NextResponse.json({ variants: data ?? [] });
});

export const POST = route(async ({ supabase, user, request }) => {
  const sb = supabase as SupabaseClient<any, any, any>;
  const body = await request.json();
  const input = SectionCreateSchema.parse(body);

  const { data, error } = await sb
    .from('section_variants')
    .insert({
      user_id: user.id,
      kind: input.kind,
      label: input.label,
      data: input.data,
    })
    .select()
    .single();

  if (error) throw error;
  return NextResponse.json({ variant: data }, { status: 201 });
});
