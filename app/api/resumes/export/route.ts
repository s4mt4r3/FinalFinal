// ============================================================
// app/api/resumes/export/route.ts
// ============================================================
//   GET /api/resumes/export?id=<uuid>&format=html|tex&scale=1
//
// Renders a composed resume from its structured section variants:
//   format=html → self-contained HTML doc (preview + html2pdf).
//                 `scale` (0.5–1) shrinks it to fit one page.
//   format=tex  → genuine Jake-style LaTeX source for Overleaf.
// ============================================================

import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { route } from '@/lib/api-helpers';
import { getComposition, compositionFromVariants } from '@/lib/compose';
import { renderHtml, renderLatex } from '@/lib/resume-render';

const QuerySchema = z.object({
  id: z.string().uuid(),
  format: z.enum(['html', 'tex']).default('html'),
  scale: z.coerce.number().min(0.5).max(1).default(1),
});

export const GET = route(async ({ supabase, request }) => {
  const sb = supabase as SupabaseClient<any, any, any>;

  const url = new URL(request.url);
  const { id, format, scale } = QuerySchema.parse({
    id: url.searchParams.get('id') ?? '',
    format: url.searchParams.get('format') ?? 'html',
    scale: url.searchParams.get('scale') ?? '1',
  });

  // Confirm ownership (RLS) before rendering.
  const { data: resume, error } = await sb
    .from('resumes')
    .select('id')
    .eq('id', id)
    .single();
  if (error || !resume) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const variants = await getComposition(sb, id);
  const composition = compositionFromVariants(variants);

  if (format === 'tex') {
    return new NextResponse(renderLatex(composition), {
      status: 200,
      headers: {
        'Content-Type': 'application/x-tex; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    });
  }

  return new NextResponse(renderHtml(composition, { scale }), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  });
});
