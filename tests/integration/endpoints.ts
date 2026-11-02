// Every authenticated endpoint, with a request that succeeds for a normal
// signed-in user. Shared by the contract and no-paywall suites.
export const ID = '11111111-1111-4111-8111-111111111111';
export const ID2 = '22222222-2222-4222-8222-222222222222';

export interface Endpoint {
  name: string;
  load: () => Promise<Record<string, any>>;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  url: string;
  params?: Record<string, string>;
  body?: unknown;
  heavy?: boolean;
  okStatus: number;
}

export const ENDPOINTS: Endpoint[] = [
  { name: 'GET /api/resumes', load: () => import('@/app/api/resumes/route'), method: 'GET', url: '/api/resumes', okStatus: 200 },
  { name: 'POST /api/resumes', load: () => import('@/app/api/resumes/route'), method: 'POST', url: '/api/resumes', body: { name: 'SWE' }, okStatus: 201 },
  { name: 'GET /api/resumes/:id', load: () => import('@/app/api/resumes/[id]/route'), method: 'GET', url: `/api/resumes/${ID}`, params: { id: ID }, okStatus: 200 },
  { name: 'PATCH /api/resumes/:id', load: () => import('@/app/api/resumes/[id]/route'), method: 'PATCH', url: `/api/resumes/${ID}`, params: { id: ID }, body: { name: 'x' }, okStatus: 200 },
  { name: 'DELETE /api/resumes/:id', load: () => import('@/app/api/resumes/[id]/route'), method: 'DELETE', url: `/api/resumes/${ID}`, params: { id: ID }, okStatus: 200 },
  { name: 'GET /api/resumes/export', load: () => import('@/app/api/resumes/export/route'), method: 'GET', url: `/api/resumes/export?id=${ID}`, heavy: true, okStatus: 200 },
  { name: 'POST /api/resumes/match', load: () => import('@/app/api/resumes/match/route'), method: 'POST', url: '/api/resumes/match', body: { job_text: 'Python and Kubernetes engineer wanted', resume_id: ID }, heavy: true, okStatus: 200 },
  { name: 'GET /api/sections', load: () => import('@/app/api/sections/route'), method: 'GET', url: '/api/sections', okStatus: 200 },
  { name: 'POST /api/sections', load: () => import('@/app/api/sections/route'), method: 'POST', url: '/api/sections', body: { kind: 'skills', label: 'Main' }, okStatus: 201 },
  { name: 'PATCH /api/sections/:id', load: () => import('@/app/api/sections/[id]/route'), method: 'PATCH', url: `/api/sections/${ID}`, params: { id: ID }, body: { label: 'x' }, okStatus: 200 },
  { name: 'DELETE /api/sections/:id', load: () => import('@/app/api/sections/[id]/route'), method: 'DELETE', url: `/api/sections/${ID}`, params: { id: ID }, okStatus: 200 },
  { name: 'GET /api/applications', load: () => import('@/app/api/applications/route'), method: 'GET', url: '/api/applications', okStatus: 200 },
  { name: 'POST /api/applications', load: () => import('@/app/api/applications/route'), method: 'POST', url: '/api/applications', body: { company: 'Acme' }, okStatus: 201 },
  { name: 'PATCH /api/applications/:id', load: () => import('@/app/api/applications/[id]/route'), method: 'PATCH', url: `/api/applications/${ID}`, params: { id: ID }, body: { status: 'offer' }, okStatus: 200 },
  { name: 'DELETE /api/applications/:id', load: () => import('@/app/api/applications/[id]/route'), method: 'DELETE', url: `/api/applications/${ID}`, params: { id: ID }, okStatus: 200 },
  { name: 'GET /api/interviews', load: () => import('@/app/api/interviews/route'), method: 'GET', url: '/api/interviews', okStatus: 200 },
  { name: 'POST /api/interviews', load: () => import('@/app/api/interviews/route'), method: 'POST', url: '/api/interviews', body: { application_id: ID }, okStatus: 201 },
  { name: 'PATCH /api/interviews/:id', load: () => import('@/app/api/interviews/[id]/route'), method: 'PATCH', url: `/api/interviews/${ID}`, params: { id: ID }, body: { notes: 'n' }, okStatus: 200 },
  { name: 'DELETE /api/interviews/:id', load: () => import('@/app/api/interviews/[id]/route'), method: 'DELETE', url: `/api/interviews/${ID}`, params: { id: ID }, okStatus: 200 },
  { name: 'GET /api/analytics', load: () => import('@/app/api/analytics/route'), method: 'GET', url: '/api/analytics', okStatus: 200 },
];

// A responder under which every endpoint's happy path succeeds.
export const happyResponder = (q: { single: boolean; table: string }) =>
  q.single
    ? { data: { id: ID, user_id: 'self', name: 'Resume', content: 'python', label: 'L', kind: 'skills', data: {}, status: 'applied' } }
    : { data: [] };
