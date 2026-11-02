// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { api, ApiError } from '@/lib/api';
import { disableDemoMode, enableDemoMode } from '@/lib/demo-mode';
import { resetDemoStore } from '@/lib/demo-store';
import { server } from '../helpers/msw';

// jsdom resolves relative fetches against its document URL.
const ORIGIN = window.location.origin;
const u = (p: string) => `${ORIGIN}${p}`;

type Seen = { method: string; url: URL; body: any; contentType: string | null };
function capture(method: 'get' | 'post' | 'patch' | 'delete', path: string, reply: unknown, status = 200) {
  const seen: Seen[] = [];
  server.use(
    http[method](u(path), async ({ request }) => {
      const text = await request.text();
      seen.push({ method: request.method, url: new URL(request.url), body: text ? JSON.parse(text) : undefined, contentType: request.headers.get('content-type') });
      return HttpResponse.json(reply as any, { status });
    })
  );
  return seen;
}

describe('api client (real mode)', () => {
  beforeEach(() => disableDemoMode());

  it.each([
    ['resumes.list', () => api.resumes.list(), 'get', '/api/resumes', { resumes: [{ id: 'r' }] }, [{ id: 'r' }]],
    ['resumes.get', () => api.resumes.get('r1'), 'get', '/api/resumes/r1', { resume: { id: 'r1' }, applications: [] }, { resume: { id: 'r1' }, applications: [] }],
    ['resumes.delete', () => api.resumes.delete('r1'), 'delete', '/api/resumes/r1', { success: true }, { success: true }],
    ['sections.delete', () => api.sections.delete('s1'), 'delete', '/api/sections/s1', { success: true }, { success: true }],
    ['interviews.delete', () => api.interviews.delete('i1'), 'delete', '/api/interviews/i1', { success: true }, { success: true }],
    ['applications.delete', () => api.applications.delete('a1'), 'delete', '/api/applications/a1', { success: true }, { success: true }],
    ['analytics.get', () => api.analytics.get(), 'get', '/api/analytics', { overall: {}, by_version: [] }, { overall: {}, by_version: [] }],
    ['auth.signOut', () => api.auth.signOut(), 'post', '/api/auth/signout', { success: true }, { success: true }],
  ] as const)('%s calls the right endpoint and unwraps the response', async (_n, fn, method, path, reply, expected) => {
    const seen = capture(method, path, reply);
    expect(await fn()).toEqual(expected);
    expect(seen).toHaveLength(1);
    expect(seen[0].method).toBe(method.toUpperCase());
  });

  it.each([
    ['resumes.create', () => api.resumes.create({ name: 'A' } as any), 'post', '/api/resumes', { resume: { id: 'r' } }, { name: 'A' }],
    ['resumes.update', () => api.resumes.update('r1', { sections: ['v'] }), 'patch', '/api/resumes/r1', { resume: { id: 'r1' } }, { sections: ['v'] }],
    ['sections.create', () => api.sections.create({ kind: 'header', label: 'H' } as any), 'post', '/api/sections', { variant: { id: 's' } }, { kind: 'header', label: 'H' }],
    ['sections.update', () => api.sections.update('s1', { label: 'L' }), 'patch', '/api/sections/s1', { variant: { id: 's1' } }, { label: 'L' }],
    ['interviews.create', () => api.interviews.create({ application_id: 'a' } as any), 'post', '/api/interviews', { interview: { id: 'i' } }, { application_id: 'a' }],
    ['interviews.update', () => api.interviews.update('i1', { notes: 'n' }), 'patch', '/api/interviews/i1', { interview: { id: 'i1' } }, { notes: 'n' }],
    ['applications.create', () => api.applications.create({ company: 'C' } as any), 'post', '/api/applications', { application: { id: 'a' } }, { company: 'C' }],
    ['applications.update', () => api.applications.update('a1', { status: 'offer' }), 'patch', '/api/applications/a1', { application: { id: 'a1' } }, { status: 'offer' }],
    ['resumes.matchKeywords', () => api.resumes.matchKeywords({ job_text: 'j', resume_text: 'r' }), 'post', '/api/resumes/match', { matched: [], missing: [], score: 0, all_keywords: [] }, { job_text: 'j', resume_text: 'r' }],
  ] as const)('%s sends a JSON body', async (_n, fn, method, path, reply, body) => {
    const seen = capture(method, path, reply);
    await fn();
    expect(seen[0].body).toEqual(body);
    expect(seen[0].contentType).toBe('application/json');
  });

  it('builds query strings and omits empty params', async () => {
    const apps = capture('get', '/api/applications', { applications: [] });
    await api.applications.list({ status: 'offer', search: '', resume_id: undefined });
    expect(apps[0].url.search).toBe('?status=offer');

    const secs = capture('get', '/api/sections', { variants: [] });
    await api.sections.list();
    await api.sections.list('skills');
    expect(secs.map((s) => s.url.search)).toEqual(['', '?kind=skills']);

    const ivs = capture('get', '/api/interviews', { interviews: [] });
    await api.interviews.list('a&b=c');
    expect(ivs[0].url.searchParams.get('application_id')).toBe('a&b=c');
  });

  it('throws ApiError carrying status, message and Zod details', async () => {
    capture('post', '/api/resumes', { error: 'Invalid request', details: { fieldErrors: { name: ['Required'] } } }, 400);
    const err = await api.resumes.create({} as any).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, message: 'Invalid request', details: { fieldErrors: { name: ['Required'] } } });
  });

  it('falls back to a generic message for non-JSON error bodies', async () => {
    server.use(http.get(u('/api/resumes'), () => new HttpResponse('<html>502</html>', { status: 502 })));
    await expect(api.resumes.list()).rejects.toMatchObject({ status: 502, message: 'Request failed: 502' });
  });

  it('exposes 401 so the UI can bounce to /login', async () => {
    capture('get', '/api/analytics', { error: 'Not authenticated' }, 401);
    await expect(api.analytics.get()).rejects.toMatchObject({ status: 401 });
  });

  it('render() returns raw text and encodes the id', async () => {
    let seen: URL | null = null;
    server.use(
      http.get(u('/api/resumes/export'), ({ request }) => {
        seen = new URL(request.url);
        return new HttpResponse('\\documentclass{article}', { headers: { 'content-type': 'application/x-tex' } });
      })
    );
    expect(await api.resumes.render('a b', 'tex')).toBe('\\documentclass{article}');
    expect(seen!.searchParams.get('id')).toBe('a b');
    expect(seen!.searchParams.get('format')).toBe('tex');
    expect(seen!.searchParams.get('scale')).toBe('1');
  });

  it('render() maps failures to ApiError', async () => {
    server.use(http.get(u('/api/resumes/export'), () => HttpResponse.json({ error: 'Not found' }, { status: 404 })));
    await expect(api.resumes.render('x')).rejects.toMatchObject({ status: 404, message: 'Not found' });
    server.use(http.get(u('/api/resumes/export'), () => new HttpResponse('boom', { status: 500 })));
    await expect(api.resumes.render('x')).rejects.toMatchObject({ status: 500, message: 'Export failed: 500' });
  });
});

describe('api client (demo mode)', () => {
  beforeEach(() => {
    resetDemoStore();
    enableDemoMode();
  });
  afterEach(() => disableDemoMode());

  // No MSW handlers are registered here; any fetch would error the test.
  it('serves every call from the in-memory store with zero network traffic', async () => {
    const resumes = await api.resumes.list();
    const { resume } = await api.resumes.get(resumes[0].id);
    const sections = await api.sections.list();
    const created = await api.resumes.create({ name: 'Demo', sections: [sections[0].id] } as any);
    await api.resumes.update(created.id, { name: 'Demo 2' });
    expect(await api.resumes.render(created.id, 'html')).toContain('<!doctype html>');
    await api.resumes.matchKeywords({ resume_id: resume.id, job_text: 'python python python' });
    await api.resumes.delete(created.id);
    const v = await api.sections.create({ kind: 'skills', label: 'x' } as any);
    await api.sections.update(v.id, { label: 'y' });
    await api.sections.delete(v.id);
    const app = await api.applications.create({ company: 'Acme' } as any);
    await api.applications.list({ status: 'applied' });
    await api.applications.update(app.id, { status: 'offer' });
    const iv = await api.interviews.create({ application_id: app.id } as any);
    await api.interviews.list(app.id);
    await api.interviews.update(iv.id, { notes: 'n' });
    await api.interviews.delete(iv.id);
    await api.applications.delete(app.id);
    await api.analytics.get();
    expect(await api.auth.signOut()).toEqual({ success: true });
  });
});
