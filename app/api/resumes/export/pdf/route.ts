// ============================================================
// app/api/resumes/export/pdf/route.ts
// ============================================================
//   GET /api/resumes/export/pdf?id=<uuid>&template=jake|compact|modern|tech
//
// Returns a complete styled HTML document. The client passes the
// HTML to html2pdf.js (browser-side) to produce a PDF download.
// We return HTML — not a PDF — so we don't have to ship a
// headless browser on Vercel.
// ============================================================

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { route } from '@/lib/api-helpers';
import { requirePlus } from '@/lib/billing';
import { renderTemplate, type TemplateId } from '@/lib/pdf-templates';

const QuerySchema = z.object({
  id: z.string().uuid(),
  template: z.enum(['jake', 'compact', 'modern', 'tech']).default('jake'),
});

export const GET = route(async ({ supabase, user, request }) => {
  await requirePlus(supabase, user.id);

  const url = new URL(request.url);
  const { id, template } = QuerySchema.parse({
    id: url.searchParams.get('id') ?? '',
    template: url.searchParams.get('template') ?? 'jake',
  });

  const { data, error } = await supabase
    .from('resumes')
    .select('name, content')
    .eq('id', id)
    .single();

  const row = data as { name: string; content: string } | null;
  if (error || !row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const html = renderTemplate(row.content, template as TemplateId);

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  });
});
