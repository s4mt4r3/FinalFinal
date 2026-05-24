// ============================================================
// app/api/resumes/match/route.ts
// ============================================================
//   POST /api/resumes/match
//     Body: { job_text, resume_id? | resume_text? }
//   Extracts keywords from the job posting, then reports which
//   are present vs missing from the resume.
// ============================================================

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { route } from '@/lib/api-helpers';
import { requirePlus } from '@/lib/billing';
import { matchKeywords } from '@/lib/keyword-matcher';

const BodySchema = z
  .object({
    job_text: z.string().min(20).max(20_000),
    resume_id: z.string().uuid().optional(),
    resume_text: z.string().max(100_000).optional(),
  })
  .refine((v) => !!v.resume_id || !!v.resume_text, {
    message: 'Provide either resume_id or resume_text.',
  });

export const POST = route(async ({ supabase, user, request }) => {
  await requirePlus(supabase, user.id);

  const body = await request.json();
  const input = BodySchema.parse(body);

  let resumeText = input.resume_text ?? '';
  if (input.resume_id) {
    const { data, error } = await supabase
      .from('resumes')
      .select('content')
      .eq('id', input.resume_id)
      .single();
    const row = data as { content: string } | null;
    if (error || !row) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }
    resumeText = row.content;
  }

  const result = matchKeywords(resumeText, input.job_text);
  return NextResponse.json(result);
});
