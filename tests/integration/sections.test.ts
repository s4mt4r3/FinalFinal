import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as list from '@/app/api/sections/route';
import * as one from '@/app/api/sections/[id]/route';
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

describe('GET /api/sections', () => {
  beforeEach(() => signOut());

  it('lists all variants, optionally filtered by a validated kind', async () => {
    const m = as(() => ({ data: [{ id: ID }] }));
    expect((await callRoute(list.GET, { url: '/api/sections' })).json).toEqual({ variants: [{ id: ID }] });
    await callRoute(list.GET, { url: '/api/sections?kind=skills' });
    expect(m.calls[1].filters).toContainEqual(['eq', 'kind', 'skills']);
  });

  it('rejects an unknown kind with 400', async () => {
    as(() => undefined);
    const res = await callRoute(list.GET, { url: "/api/sections?kind=skills';--" });
    expect(res.status).toBe(400);
  });

  it('normalises a null list to []', async () => {
    as(() => ({ data: null }));
    expect((await callRoute(list.GET, { url: '/api/sections' })).json).toEqual({ variants: [] });
  });
});

describe('POST /api/sections', () => {
  it('inserts with the session user id', async () => {
    const m = as((q) => ({ data: { id: ID, ...(q.payload as object) } }));
    const res = await callRoute(list.POST, {
      method: 'POST',
      url: '/api/sections',
      body: { kind: 'header', label: 'Main', data: { name: 'A' }, user_id: 'attacker' },
    });
    expect(res.status).toBe(201);
    expect(m.callsTo('section_variants', 'insert')[0].payload).toEqual({ user_id: user.id, kind: 'header', label: 'Main', data: { name: 'A' } });
  });

  it('rejects oversized data with 400', async () => {
    as(() => undefined);
    const res = await callRoute(list.POST, { method: 'POST', url: '/api/sections', body: { kind: 'skills', label: 'x', data: { k: 'x'.repeat(60_000) } } });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.json)).toContain('Section data too large');
  });
});

describe('PATCH /api/sections/:id', () => {
  it('returns 400 for an empty patch', async () => {
    as(() => undefined);
    const res = await callRoute(one.PATCH, { method: 'PATCH', url: `/api/sections/${ID}`, params: { id: ID }, body: {} });
    expect(res).toMatchObject({ status: 400, json: { error: 'Nothing to update' } });
  });

  it('a label-only edit does not touch resume caches', async () => {
    const m = as((q) => (q.op === 'update' ? { data: { id: ID, label: 'L' } } : undefined));
    const res = await callRoute(one.PATCH, { method: 'PATCH', url: `/api/sections/${ID}`, params: { id: ID }, body: { label: 'L' } });
    expect(res.json).toEqual({ variant: { id: ID, label: 'L' } });
    expect(m.callsTo('resume_sections')).toHaveLength(0);
  });

  it('a data edit refreshes the text cache of every resume using the variant (deduplicated)', async () => {
    const v = variant('skills', { id: ID, data: { categories: [{ category: 'Langs', items: 'Rust' }] } });
    const m = as((q) => {
      if (q.table === 'section_variants' && q.op === 'update') return { data: v };
      if (q.table === 'resume_sections' && q.filters.some((f) => f[1] === 'variant_id'))
        return { data: [{ resume_id: 'r1' }, { resume_id: 'r2' }, { resume_id: 'r1' }] };
      if (q.table === 'resume_sections') return { data: [{ variant_id: ID, position: 0 }] };
      if (q.table === 'section_variants') return { data: [v] };
    });
    await callRoute(one.PATCH, { method: 'PATCH', url: `/api/sections/${ID}`, params: { id: ID }, body: { data: v.data } });
    const updates = m.callsTo('resumes', 'update');
    expect(updates.map((u) => u.filters)).toEqual([[['eq', 'id', 'r1']], [['eq', 'id', 'r2']]]);
    expect((updates[0].payload as any).content).toContain('Langs: Rust');
  });

  it('returns 404 for another user’s variant', async () => {
    as(() => ({ data: null, error: { code: 'PGRST116', message: 'no rows' } }));
    const res = await callRoute(one.PATCH, { method: 'PATCH', url: `/api/sections/${ID}`, params: { id: ID }, body: { label: 'x' } });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/sections/:id', () => {
  it('deletes and refreshes affected resumes after the cascade', async () => {
    const m = as((q) => {
      if (q.table === 'resume_sections' && q.filters.some((f) => f[1] === 'variant_id')) return { data: [{ resume_id: 'r1' }] };
      if (q.table === 'resume_sections') return { data: [] };
    });
    const res = await callRoute(one.DELETE, { method: 'DELETE', url: `/api/sections/${ID2}`, params: { id: ID2 } });
    expect(res.json).toEqual({ success: true });
    const order = m.calls.map((c) => `${c.table}:${c.op}`);
    expect(order.indexOf('section_variants:delete')).toBeLessThan(order.indexOf('resumes:update'));
    expect(m.callsTo('resumes', 'update')[0].payload).toEqual({ content: '' });
  });

  it('propagates delete failure', async () => {
    silenceConsoleError();
    as((q) => (q.op === 'delete' ? { error: pgError() } : undefined));
    expect((await callRoute(one.DELETE, { method: 'DELETE', url: `/api/sections/${ID}`, params: { id: ID } })).status).toBe(500);
  });

  it('returns 400 for a non-uuid id', async () => {
    as(() => undefined);
    expect((await callRoute(one.DELETE, { method: 'DELETE', url: '/api/sections/1', params: { id: '1' } })).status).toBe(400);
  });
});
