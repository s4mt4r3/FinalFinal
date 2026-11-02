import { describe, expect, it, vi } from 'vitest';
import * as apps from '@/app/api/applications/route';
import * as app from '@/app/api/applications/[id]/route';
import * as ivs from '@/app/api/interviews/route';
import * as iv from '@/app/api/interviews/[id]/route';
import * as analytics from '@/app/api/analytics/route';
import { callRoute, newUser } from '../helpers/route';
import { createSupabaseMock, type Responder } from '../helpers/supabase-mock';
import { signInAs } from '../helpers/mock-supabase-server';
import { ID } from './endpoints';

vi.mock('@/lib/supabase-server', () => import('../helpers/mock-supabase-server'));

let user = newUser();
function as(respond: Responder) {
  user = newUser();
  const m = createSupabaseMock(respond);
  signInAs(user, m.client);
  return m;
}

describe('applications', () => {
  it('GET applies validated filters and escapes LIKE wildcards in search', async () => {
    const m = as(() => ({ data: [] }));
    const res = await callRoute(apps.GET, { url: `/api/applications?status=offer&resume_id=${ID}&search=50%25_off\\` });
    expect(res.status).toBe(200);
    const f = m.calls[0].filters;
    expect(f).toContainEqual(['eq', 'status', 'offer']);
    expect(f).toContainEqual(['eq', 'resume_id', ID]);
    expect(f).toContainEqual(['or', 'company.ilike.%50\\%\\_off\\\\%,role.ilike.%50\\%\\_off\\\\%']);
  });

  it.each([['status=hired'], ['resume_id=1'], [`search=${'x'.repeat(101)}`]])('GET rejects bad query %s', async (qs) => {
    as(() => undefined);
    expect((await callRoute(apps.GET, { url: `/api/applications?${qs}` })).status).toBe(400);
  });

  it('POST stamps user_id from the session and defaults date_applied', async () => {
    const m = as((q) => ({ data: q.payload }));
    const res = await callRoute(apps.POST, { method: 'POST', url: '/api/applications', body: { company: 'Acme', user_id: 'x' } });
    expect(res.status).toBe(201);
    const p = m.callsTo('applications', 'insert')[0].payload as any;
    expect(p).toMatchObject({ user_id: user.id, company: 'Acme', role: null, resume_id: null, status: 'applied', notes: '' });
    expect(new Date(p.date_applied).toString()).not.toBe('Invalid Date');
  });

  it('PATCH sends only validated fields; DELETE scopes by id', async () => {
    const m = as((q) => (q.op === 'update' ? { data: { id: ID } } : undefined));
    const res = await callRoute(app.PATCH, { method: 'PATCH', url: `/api/applications/${ID}`, params: { id: ID }, body: { status: 'offer', user_id: 'x' } });
    expect(res.json).toEqual({ application: { id: ID } });
    expect(m.callsTo('applications', 'update')[0].payload).toEqual({ status: 'offer' });
    await callRoute(app.DELETE, { method: 'DELETE', url: `/api/applications/${ID}`, params: { id: ID } });
    expect(m.callsTo('applications', 'delete')[0].filters).toEqual([['eq', 'id', ID]]);
  });

  it('PATCH rejects an invalid status', async () => {
    as(() => undefined);
    expect((await callRoute(app.PATCH, { method: 'PATCH', url: `/api/applications/${ID}`, params: { id: ID }, body: { status: 'hired' } })).status).toBe(400);
  });
});

describe('interviews', () => {
  it('GET filters by a validated application_id and rejects junk', async () => {
    const m = as(() => ({ data: [] }));
    await callRoute(ivs.GET, { url: `/api/interviews?application_id=${ID}` });
    expect(m.calls[0].filters).toContainEqual(['eq', 'application_id', ID]);
    expect((await callRoute(ivs.GET, { url: '/api/interviews?application_id=nope' })).status).toBe(400);
  });

  it('POST stamps user_id and nulls optional fields', async () => {
    const m = as((q) => ({ data: q.payload }));
    const res = await callRoute(ivs.POST, { method: 'POST', url: '/api/interviews', body: { application_id: ID, user_id: 'x' } });
    expect(res.status).toBe(201);
    expect(m.callsTo('interviews', 'insert')[0].payload).toEqual({
      user_id: user.id, application_id: ID, scheduled_at: null, kind: null, notes: '', outcome: null,
    });
  });

  it.each([
    [{ application_id: 'x' }],
    [{ application_id: ID, outcome: 'won' }],
    [{ application_id: ID, kind: 'x'.repeat(41) }],
    [{ application_id: ID, scheduled_at: 'tomorrow' }],
  ])('POST rejects %j', async (body) => {
    as(() => undefined);
    expect((await callRoute(ivs.POST, { method: 'POST', url: '/api/interviews', body })).status).toBe(400);
  });

  it('PATCH/DELETE work and validate', async () => {
    const m = as((q) => (q.op === 'update' ? { data: { id: ID } } : undefined));
    expect((await callRoute(iv.PATCH, { method: 'PATCH', url: `/api/interviews/${ID}`, params: { id: ID }, body: { outcome: 'passed' } })).json).toEqual({ interview: { id: ID } });
    expect(m.callsTo('interviews', 'update')[0].payload).toEqual({ outcome: 'passed' });
    expect((await callRoute(iv.PATCH, { method: 'PATCH', url: `/api/interviews/${ID}`, params: { id: ID }, body: { outcome: 'won' } })).status).toBe(400);
    expect((await callRoute(iv.DELETE, { method: 'DELETE', url: `/api/interviews/${ID}`, params: { id: ID } })).json).toEqual({ success: true });
  });
});

describe('GET /api/analytics', () => {
  it('aggregates totals and passes through per-version stats', async () => {
    as((q) =>
      q.table === 'version_stats'
        ? { data: [{ resume_id: ID, callback_rate_pct: 50 }] }
        : { data: [{ status: 'applied' }, { status: 'interviewing' }, { status: 'offer' }, { status: 'rejected' }] }
    );
    const res = await callRoute(analytics.GET, { url: '/api/analytics' });
    expect(res.json).toEqual({
      overall: { total_applications: 4, callbacks: 2, offers: 1, callback_rate_pct: 50 },
      by_version: [{ resume_id: ID, callback_rate_pct: 50 }],
    });
  });

  it('reports a 0% rate (not NaN) with no applications', async () => {
    as(() => ({ data: [] }));
    expect((await callRoute(analytics.GET, { url: '/api/analytics' })).json.overall).toEqual({
      total_applications: 0, callbacks: 0, offers: 0, callback_rate_pct: 0,
    });
  });
});
