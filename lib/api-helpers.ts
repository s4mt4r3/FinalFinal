// ============================================================
// lib/api-helpers.ts
// ============================================================
// Small utilities every API route uses:
//   - zod schemas for request validation
//   - error → HTTP response mapping
//   - a `route` wrapper that handles auth + errors uniformly
// ============================================================

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser, AuthError } from './supabase-server';
import { checkRateLimit } from './rate-limit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// ------------------------------------------------------------
// Validation schemas
// ------------------------------------------------------------
// zod parses unknown input and gives you a typed object back,
// throwing if anything is wrong. This is your defense against
// junk requests.
// ------------------------------------------------------------

export const ResumeCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  content: z.string().max(100_000).default(''),
  parent_id: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).default([]),
  notes: z.string().max(2000).default(''),
  source_file_path: z.string().max(500).nullable().optional(),
  // Composition: ordered section-variant ids that make up this resume.
  sections: z.array(z.string().uuid()).max(40).optional(),
});

export const ResumeUpdateSchema = ResumeCreateSchema.partial();

// ------------------------------------------------------------
// Section variant schemas
// ------------------------------------------------------------
export const SectionKindSchema = z.enum([
  'header',
  'education',
  'coursework',
  'experience',
  'projects',
  'skills',
  'leadership',
]);

// `data` is structured JSON whose shape depends on kind. Keys are
// capped at 60 chars; serialized size is capped at 50 KB.
const JsonObject = z
  .record(z.string().max(60), z.unknown())
  .refine((v) => JSON.stringify(v).length <= 50_000, { message: 'Section data too large (max 50 KB)' });

export const SectionCreateSchema = z.object({
  kind: SectionKindSchema,
  label: z.string().trim().min(1).max(120),
  data: JsonObject.default({}),
});

export const SectionUpdateSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    data: JsonObject,
  })
  .partial();

export const ApplicationStatusSchema = z.enum([
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'ghosted',
]);

export const ApplicationCreateSchema = z.object({
  company: z.string().trim().min(1).max(200),
  role: z.string().max(200).nullable().optional(),
  resume_id: z.string().uuid().nullable().optional(),
  status: ApplicationStatusSchema.default('applied'),
  notes: z.string().max(5000).default(''),
  date_applied: z.string().datetime().optional(),
});

export const ApplicationUpdateSchema = ApplicationCreateSchema.partial();

// ------------------------------------------------------------
// Error → response mapping
// ------------------------------------------------------------
export function errorResponse(err: unknown) {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      { error: 'Invalid request', details: err.flatten() },
      { status: 400 }
    );
  }
  // Log the full error server-side so we can debug 500s.
  console.error('[api] error:', err);
  if (err instanceof Error) {
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
  // Supabase PostgrestError has a `message` property but does not extend Error.
  if (err && typeof err === 'object' && 'message' in err) {
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : String((err as { message: unknown }).message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
  return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
}

// ------------------------------------------------------------
// route() — handles auth + errors so each route stays small
// ------------------------------------------------------------
type Handler = (ctx: {
  user: { id: string; email?: string };
  supabase: SupabaseClient<Database>;
  request: Request;
  params: Record<string, string>;
}) => Promise<NextResponse> | NextResponse;

export function route(handler: Handler) {
  return async (
    request: Request,
    context: { params: Promise<Record<string, string>> } | undefined
  ) => {
    try {
      const { user, supabase } = await getCurrentUser();
      const { allowed, retryAfter } = checkRateLimit(user.id, new URL(request.url).pathname);
      if (!allowed) {
        return NextResponse.json(
          { error: 'Too many requests' },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        );
      }
      const params = context ? await context.params : {};
      return await handler({ user, supabase, request, params });
    } catch (err) {
      return errorResponse(err);
    }
  };
}
