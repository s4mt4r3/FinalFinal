// ============================================================
// lib/compose.ts
// ============================================================
// Server-side helpers for resume compositions: reading the
// ordered section variants that make up a resume, replacing that
// composition, and keeping the resumes.content text cache in sync
// (so keyword-match / analytics / .txt export keep working).
//
// We use a loosely-typed Supabase client here on purpose: the
// hand-written Database type resolves inserts to `never` for the
// new tables, so we cast and re-type the results against our
// domain types.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SectionVariant } from '@/types/database';
import { SECTION_TITLE } from '@/lib/sections';
import { renderText, type Composition } from '@/lib/resume-render';

type LooseClient = SupabaseClient<any, any, any>;

// Map stored variants → the Composition the renderers expect.
export function compositionFromVariants(variants: SectionVariant[]): Composition {
  return variants.map((v) => ({
    kind: v.kind,
    title: SECTION_TITLE[v.kind],
    data: v.data,
  }));
}

// Ordered, hydrated variants that make up a resume.
export async function getComposition(
  supabase: SupabaseClient<any>,
  resumeId: string
): Promise<SectionVariant[]> {
  const sb = supabase as LooseClient;

  const { data: joins, error: jErr } = await sb
    .from('resume_sections')
    .select('variant_id, position')
    .eq('resume_id', resumeId)
    .order('position', { ascending: true });
  if (jErr) throw jErr;

  const rows = (joins ?? []) as { variant_id: string; position: number }[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.variant_id);
  const { data: variants, error: vErr } = await sb
    .from('section_variants')
    .select('*')
    .in('id', ids);
  if (vErr) throw vErr;

  const byId = new Map<string, SectionVariant>(
    ((variants ?? []) as SectionVariant[]).map((v) => [v.id, v])
  );
  // Preserve the join order; drop any variant that vanished.
  return rows.map((r) => byId.get(r.variant_id)).filter(Boolean) as SectionVariant[];
}

// Replace a resume's composition with the given ordered variant ids,
// then regenerate its content cache. Returns the hydrated variants.
export async function setComposition(
  supabase: SupabaseClient<any>,
  resumeId: string,
  variantIds: string[]
): Promise<SectionVariant[]> {
  const sb = supabase as LooseClient;

  // 1. Clear the existing composition.
  const { error: delErr } = await sb
    .from('resume_sections')
    .delete()
    .eq('resume_id', resumeId);
  if (delErr) throw delErr;

  // 2. Insert the new ordered rows (RLS enforces ownership of both
  //    the resume and each variant).
  if (variantIds.length > 0) {
    const rows = variantIds.map((variant_id, position) => ({
      resume_id: resumeId,
      variant_id,
      position,
    }));
    const { error: insErr } = await sb.from('resume_sections').insert(rows);
    if (insErr) throw insErr;
  }

  // 3. Hydrate in order and refresh the content cache.
  const variants = await getComposition(sb, resumeId);
  await regenerateContent(sb, resumeId, variants);
  return variants;
}

// Re-render the plain-text cache for a resume from its variants.
export async function regenerateContent(
  supabase: SupabaseClient<any>,
  resumeId: string,
  variants: SectionVariant[]
): Promise<void> {
  const sb = supabase as LooseClient;
  const content = renderText(compositionFromVariants(variants));
  const { error } = await sb.from('resumes').update({ content }).eq('id', resumeId);
  if (error) throw error;
}
