import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as list from '@/app/api/resumes/route';
import * as one from '@/app/api/resumes/[id]/route';
import { callRoute, newUser, silenceConsoleError } from '../helpers/route';
import { createSupabaseMock, pgError, type Responder } from '../helpers/supabase-mock';
import { signInAs, signOut } from '../helpers/mock-supabase-server';
import { ID, ID2 } from './endpoints';
import { variant } from '../helpers/fixtures';

vi.mock('@/lib/supabase-server', () => import('../helpers/mock-supabase-server'));

let user = newUser();
function as(respond: Responder) {
  user = newUser();
  const m = createSupabaseMock(respond);
  signInAs(user, m.client);
  return m;
}

const zodShape = { error: 'Invalid request', details: { formErrors: expect.any(Array), fieldErrors: expect.any(Object) } };

describe('GET /api/resumes', () => {
  beforeEach(() => signOut());

  it('lists resumes newest first, relying on RLS for scoping', async () => {
    const m = as(() => ({ data: [{ id: ID }] }));
    const res = await callRoute(list.GET, { url: '/api/resumes' });
    expect(res.json).toEqual({ resumes: [{ id: ID }] });
    expect(m.calls[0].filters).toEqual([['order', 'created_at', { ascending: false }]]);
  });
});

describe('POST /api/resumes', () => {
  it('creates the shell with the session user id (ignoring any body user_id) and attaches sections in order', async () => {
    const h = variant('header', { id: ID });
    const s = variant('skills', { id: ID2 });
    const m = as((q) => {
      if (q.table === 'resumes' && q.op === 'insert') return { data: { id: 'new-r', ...(q.payload as object) } };
      if (q.table === 'resume_sections' && q.op === 'select') return { data: [{ variant_id: ID2, position: 0 }, { variant_id: ID, position: 1 }] };
      if (q.table === 'section_variants') return { data: [h, s] };
    });
    const res = await callRoute(list.POST, {
      method: 'POST',
      url: '/api/resumes',
      body: { name: '  SWE  ', user_id: 'attacker', tags: ['t'], sections: [ID2, ID], parent_id: ID },
    });
    expect(res.status).toBe(201);
    const insert = m.callsTo('resumes', 'insert')[0].payload as any;
    expect(insert).toEqual({ user_id: user.id, name: 'SWE', content: '', parent_id: null, tags: ['t'], notes: '' });
    expect(m.callsTo('resume_sections', 'insert')[0].payload).toEqual([
      { resume_id: 'new-r', variant_id: ID2, position: 0 },
      { resume_id: 'new-r', variant_id: ID, position: 1 },
    ]);
    expect(res.json.resume.sections.map((v: any) => v.id)).toEqual([ID2, ID]);
  });

  it('returns 400 with the Zod error shape for an invalid body', async () => {
    as(() => undefined);
    const res = await callRoute(list.POST, { method: 'POST', url: '/api/resumes', body: { name: '', sections: ['x'] } });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject(zodShape);
    expect(res.json.details.fieldErrors).toHaveProperty('name');
    expect(res.json.details.fieldErrors).toHaveProperty('sections');
  });

  // BUG: request.json() throws a SyntaxError that errorResponse maps to 500.
  it('returns 400 (not 500) for a malformed JSON body', async () => {
    as(() => undefined);
    silenceConsoleError();
    const res = await callRoute(list.POST, { method: 'POST', url: '/api/resumes', body: '{"name": ' });
    expect(res.status).toBe(400);
  });

  it('rejects an oversized payload', async () => {
    as(() => undefined);
    const res = await callRoute(list.POST, { method: 'POST', url: '/api/resumes', body: { name: 'a', content: 'x'.repeat(100_001) } });
    expect(res.status).toBe(400);
  });

  it('fails cleanly when the insert is rejected', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    silenceConsoleError();
    as((q) => (q.op === 'insert' ? { error: pgError() } : undefined));
    const res = await callRoute(list.POST, { method: 'POST', url: '/api/resumes', body: { name: 'a' } });
    expect(res.status).toBe(500);
    expect(res.json).toEqual({ error: 'Internal server error' });
  });

  it('fails cleanly when the insert returns no row', async () => {
    silenceConsoleError();
    as(() => ({ data: null }));
    const res = await callRoute(list.POST, { method: 'POST', url: '/api/resumes', body: { name: 'a' } });
    expect(res.status).toBe(500);
  });
});

describe('GET /api/resumes/:id', () => {
  it('returns the resume with its ordered sections and linked applications', async () => {
    const h = variant('header', { id: ID2 });
    as((q) => {
      if (q.table === 'resumes') return { data: { id: ID, name: 'R' } };
      if (q.table === 'applications') return { data: [{ id: 'a1' }] };
      if (q.table === 'resume_sections') return { data: [{ variant_id: ID2, position: 0 }] };
      if (q.table === 'section_variants') return { data: [h] };
    });
    const res = await callRoute(one.GET, { url: `/api/resumes/${ID}`, params: { id: ID } });
    expect(res.status).toBe(200);
    expect(res.json.resume).toMatchObject({ id: ID, name: 'R', sections: [{ id: ID2 }] });
    expect(res.json.applications).toEqual([{ id: 'a1' }]);
  });

  it('returns 404 for another user’s resume (RLS hides it) without revealing existence', async () => {
    as((q) => (q.table === 'resumes' ? { data: null, error: { code: 'PGRST116', message: 'no rows' } } : undefined));
    const res = await callRoute(one.GET, { url: `/api/resumes/${ID}`, params: { id: ID } });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Not found' });
  });

  it('returns 400 for a non-uuid id', async () => {
    as(() => undefined);
    const res = await callRoute(one.GET, { url: '/api/resumes/abc', params: { id: 'abc' } });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject(zodShape);
  });
});

describe('PATCH /api/resumes/:id', () => {
  it('updates only provided metadata and keeps the existing composition', async () => {
    const m = as((q) => {
      if (q.table === 'resumes' && q.op === 'select') return { data: { id: ID, name: 'New' } };
      if (q.table === 'resume_sections') return { data: [] };
    });
    const res = await callRoute(one.PATCH, { method: 'PATCH', url: `/api/resumes/${ID}`, params: { id: ID }, body: { name: 'New' } });
    expect(res.status).toBe(200);
    expect(m.callsTo('resumes', 'update')[0].payload).toEqual({ name: 'New' });
    expect(m.callsTo('resume_sections', 'delete')).toHaveLength(0);
  });

  it('replaces the composition when sections are supplied (reorder/remove)', async () => {
    const m = as((q) => {
      if (q.table === 'resumes' && q.op === 'select') return { data: { id: ID } };
      if (q.table === 'resume_sections' && q.op === 'select') return { data: [{ variant_id: ID2, position: 0 }] };
      if (q.table === 'section_variants') return { data: [variant('skills', { id: ID2 })] };
    });
    const res = await callRoute(one.PATCH, { method: 'PATCH', url: `/api/resumes/${ID}`, params: { id: ID }, body: { sections: [ID2] } });
    expect(res.status).toBe(200);
    expect(m.callsTo('resumes', 'update')).toHaveLength(1);
    expect(m.callsTo('resumes', 'update')[0].payload).toHaveProperty('content');
    expect(m.callsTo('resume_sections', 'insert')[0].payload).toEqual([{ resume_id: ID, variant_id: ID2, position: 0 }]);
    expect(res.json.resume.sections).toHaveLength(1);
  });

  it('returns 400 and keeps the composition when a section id is unknown', async () => {
    const m = as((q) => (q.table === 'section_variants' ? { data: [] } : undefined));
    const res = await callRoute(one.PATCH, { method: 'PATCH', url: `/api/resumes/${ID}`, params: { id: ID }, body: { sections: [ID2] } });
    expect(res).toMatchObject({ status: 400, json: { error: 'One or more sections no longer exist' } });
    expect(m.callsTo('resume_sections', 'delete')).toHaveLength(0);
  });

  it('skips the metadata update for an empty patch', async () => {
    const m = as((q) => (q.table === 'resumes' ? { data: { id: ID } } : undefined));
    await callRoute(one.PATCH, { method: 'PATCH', url: `/api/resumes/${ID}`, params: { id: ID }, body: {} });
    expect(m.callsTo('resumes', 'update')).toHaveLength(0);
  });

  it('returns 404 when the resume is not visible to this user', async () => {
    as(() => ({ data: null }));
    const res = await callRoute(one.PATCH, { method: 'PATCH', url: `/api/resumes/${ID}`, params: { id: ID }, body: { name: 'x' } });
    expect(res.status).toBe(404);
  });

  it('propagates a metadata update failure', async () => {
    silenceConsoleError();
    as((q) => (q.op === 'update' ? { error: pgError() } : undefined));
    const res = await callRoute(one.PATCH, { method: 'PATCH', url: `/api/resumes/${ID}`, params: { id: ID }, body: { name: 'x' } });
    expect(res.status).toBe(500);
  });

  it('validates the body', async () => {
    as(() => undefined);
    const res = await callRoute(one.PATCH, { method: 'PATCH', url: `/api/resumes/${ID}`, params: { id: ID }, body: { tags: 'nope' } });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/resumes/:id', () => {
  it('deletes by id (RLS limits it to the owner)', async () => {
    const m = as(() => undefined);
    const res = await callRoute(one.DELETE, { method: 'DELETE', url: `/api/resumes/${ID}`, params: { id: ID } });
    expect(res.json).toEqual({ success: true });
    expect(m.callsTo('resumes', 'delete')[0].filters).toEqual([['eq', 'id', ID]]);
  });

  it('propagates delete failures', async () => {
    silenceConsoleError();
    as(() => ({ error: pgError() }));
    expect((await callRoute(one.DELETE, { method: 'DELETE', url: `/api/resumes/${ID}`, params: { id: ID } })).status).toBe(500);
  });
});
