// ============================================================
// lib/api.ts
// ============================================================
// Type-safe wrappers around the /api routes. Use these from
// React components instead of raw fetch. Every function returns
// typed data and throws a useful error on failure.
//
// Example usage in a component:
//
//   import { api } from '@/lib/api';
//
//   const resumes = await api.resumes.list();
//   const created = await api.resumes.create({ name: 'SWE' });
//   await api.applications.update(id, { status: 'offer' });
// ============================================================

import type {
  Resume,
  Application,
  ApplicationStatus,
  VersionStat,
  ResumeInsert,
  ResumeUpdate,
  ApplicationInsert,
  ApplicationUpdate,
  SectionVariant,
  SectionVariantInsert,
  SectionVariantUpdate,
  SectionKind,
  ComposedResume,
} from '@/types/database';

// ------------------------------------------------------------
// Shared fetch helper
// ------------------------------------------------------------
async function call<T>(
  path: string,
  init?: RequestInit & { params?: Record<string, string | undefined> }
): Promise<T> {
  const { params, ...rest } = init ?? {};
  let url = path;
  if (params) {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') usp.set(k, v);
    }
    const qs = usp.toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(rest.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      body.error ?? `Request failed: ${res.status}`,
      res.status,
      body.details
    );
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ------------------------------------------------------------
// API surface
// ------------------------------------------------------------
export const api = {
  resumes: {
    list: () => call<{ resumes: Resume[] }>('/api/resumes').then((r) => r.resumes),

    get: (id: string) =>
      call<{ resume: ComposedResume; applications: Application[] }>(
        `/api/resumes/${id}`
      ),

    create: (input: ResumeInsert) =>
      call<{ resume: ComposedResume }>('/api/resumes', {
        method: 'POST',
        body: JSON.stringify(input),
      }).then((r) => r.resume),

    update: (id: string, patch: ResumeUpdate) =>
      call<{ resume: ComposedResume }>(`/api/resumes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }).then((r) => r.resume),

    delete: (id: string) =>
      call<{ success: true }>(`/api/resumes/${id}`, { method: 'DELETE' }),

    // Render a composed resume. format: 'html' (for preview/html2pdf) or 'tex'.
    // `scale` shrinks the HTML to fit one page (ignored for tex).
    render: async (id: string, format: 'html' | 'tex' = 'html', scale = 1): Promise<string> => {
      const res = await fetch(
        `/api/resumes/export?id=${encodeURIComponent(id)}&format=${format}&scale=${scale}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(
          body.error ?? `Export failed: ${res.status}`,
          res.status,
          body.code ?? body.details
        );
      }
      return res.text();
    },

    matchKeywords: (input: { resume_id?: string; resume_text?: string; job_text: string }) =>
      call<{
        matched: string[];
        missing: string[];
        score: number;
        all_keywords: { term: string; count: number; matched: boolean }[];
      }>('/api/resumes/match', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  },

  sections: {
    list: (kind?: SectionKind) =>
      call<{ variants: SectionVariant[] }>('/api/sections', {
        params: { kind },
      }).then((r) => r.variants),

    create: (input: SectionVariantInsert) =>
      call<{ variant: SectionVariant }>('/api/sections', {
        method: 'POST',
        body: JSON.stringify(input),
      }).then((r) => r.variant),

    update: (id: string, patch: SectionVariantUpdate) =>
      call<{ variant: SectionVariant }>(`/api/sections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }).then((r) => r.variant),

    delete: (id: string) =>
      call<{ success: true }>(`/api/sections/${id}`, { method: 'DELETE' }),
  },

  interviews: {
    list: (applicationId?: string) =>
      call<{ interviews: import('@/types/database').Interview[] }>(
        '/api/interviews',
        { params: { application_id: applicationId } }
      ).then((r) => r.interviews),

    create: (input: import('@/types/database').InterviewInsert) =>
      call<{ interview: import('@/types/database').Interview }>(
        '/api/interviews',
        { method: 'POST', body: JSON.stringify(input) }
      ).then((r) => r.interview),

    update: (
      id: string,
      patch: import('@/types/database').InterviewUpdate
    ) =>
      call<{ interview: import('@/types/database').Interview }>(
        `/api/interviews/${id}`,
        { method: 'PATCH', body: JSON.stringify(patch) }
      ).then((r) => r.interview),

    delete: (id: string) =>
      call<{ success: true }>(`/api/interviews/${id}`, { method: 'DELETE' }),
  },

  applications: {
    list: (filters?: {
      status?: ApplicationStatus;
      resume_id?: string;
      search?: string;
    }) =>
      call<{ applications: Application[] }>('/api/applications', {
        params: filters,
      }).then((r) => r.applications),

    create: (input: ApplicationInsert) =>
      call<{ application: Application }>('/api/applications', {
        method: 'POST',
        body: JSON.stringify(input),
      }).then((r) => r.application),

    update: (id: string, patch: ApplicationUpdate) =>
      call<{ application: Application }>(`/api/applications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }).then((r) => r.application),

    delete: (id: string) =>
      call<{ success: true }>(`/api/applications/${id}`, { method: 'DELETE' }),
  },

  analytics: {
    get: () =>
      call<{
        overall: {
          total_applications: number;
          callbacks: number;
          offers: number;
          callback_rate_pct: number;
        };
        by_version: VersionStat[];
      }>('/api/analytics'),
  },

  auth: {
    signOut: () =>
      call<{ success: true }>('/api/auth/signout', { method: 'POST' }),
  },
};
