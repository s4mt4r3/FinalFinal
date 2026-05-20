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
      call<{ resume: Resume; children: Resume[]; applications: Application[] }>(
        `/api/resumes/${id}`
      ),

    create: (input: ResumeInsert) =>
      call<{ resume: Resume }>('/api/resumes', {
        method: 'POST',
        body: JSON.stringify(input),
      }).then((r) => r.resume),

    update: (id: string, patch: ResumeUpdate) =>
      call<{ resume: Resume }>(`/api/resumes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }).then((r) => r.resume),

    delete: (id: string) =>
      call<{ success: true }>(`/api/resumes/${id}`, { method: 'DELETE' }),
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
