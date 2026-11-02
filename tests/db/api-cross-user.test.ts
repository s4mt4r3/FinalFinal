import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as resumes from '@/app/api/resumes/route';
import * as resume from '@/app/api/resumes/[id]/route';
import * as exp from '@/app/api/resumes/export/route';
import * as match from '@/app/api/resumes/match/route';
import * as sections from '@/app/api/sections/route';
import * as section from '@/app/api/sections/[id]/route';
import * as apps from '@/app/api/applications/route';
import * as app from '@/app/api/applications/[id]/route';
import * as ivs from '@/app/api/interviews/route';
import * as iv from '@/app/api/interviews/[id]/route';
import * as analytics from '@/app/api/analytics/route';
import { callRoute } from '../helpers/route';
import { admin, createTestUser, deleteTestUsers, sampleHeader, sessionCookiesFor, type TestUser } from '../helpers/local-supabase';

// Route handlers read the session from next/headers; feed them a real user's cookies.
const jar = vi.hoisted(() => ({ cookies: [] as { name: string; value: string }[] }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => jar.cookies, set: () => {} }),
}));

let A: TestUser;
let B: TestUser;
let cookiesA: typeof jar.cookies;
let cookiesB: typeof jar.cookies;
const asA = () => (jar.cookies = cookiesA);
const asB = () => (jar.cookies = cookiesB);

const ids = {} as Record<string, string>;

async function seedVia(u: 'A' | 'B') {
  u === 'A' ? asA() : asB();
  const h = await callRoute(sections.POST, { method: 'POST', url: '/api/sections', body: { kind: 'header', label: 'H', data: { ...sampleHeader, name: `${u} Person` } } });
  const s = await callRoute(sections.POST, { method: 'POST', url: '/api/sections', body: { kind: 'skills', label: 'S', data: { categories: [{ category: 'Langs', items: `${u}-lang` }] } } });
  const r = await callRoute(resumes.POST, { method: 'POST', url: '/api/resumes', body: { name: `${u} resume`, sections: [h.json.variant.id, s.json.variant.id] } });
  const ap = await callRoute(apps.POST, { method: 'POST', url: '/api/applications', body: { company: `${u} Corp`, resume_id: r.json.resume.id } });
  const i = await callRoute(ivs.POST, { method: 'POST', url: '/api/interviews', body: { application_id: ap.json.application.id } });
  for (const res of [h, s, r, ap, i]) expect(res.status).toBe(201);
  Object.assign(ids, {
    [`${u}header`]: h.json.variant.id,
    [`${u}skills`]: s.json.variant.id,
    [`${u}resume`]: r.json.resume.id,
    [`${u}app`]: ap.json.application.id,
    [`${u}iv`]: i.json.interview.id,
  });
}

const row = async (table: string, id: string) => (await admin.from(table).select('*').eq('id', id).maybeSingle()).data;
const composition = async (resumeId: string) =>
  ((await admin.from('resume_sections').select('variant_id, position').eq('resume_id', resumeId).order('position')).data ?? []).map((r) => r.variant_id);

beforeAll(async () => {
  A = await createTestUser('api-a');
  B = await createTestUser('api-b');
  cookiesA = await sessionCookiesFor(A);
  cookiesB = await sessionCookiesFor(B);
  await seedVia('A');
  await seedVia('B');
});
afterAll(deleteTestUsers);

describe('happy path against the real database', () => {
  it('B’s resume was composed in order with a generated text cache', async () => {
    expect(await composition(ids.Bresume)).toEqual([ids.Bheader, ids.Bskills]);
    expect((await row('resumes', ids.Bresume))!.content).toContain('B Person');
  });

  it('reorders and removes sections, and the change persists', async () => {
    asA();
    const res = await callRoute(resume.PATCH, { method: 'PATCH', url: `/api/resumes/${ids.Aresume}`, params: { id: ids.Aresume }, body: { sections: [ids.Askills] } });
    expect(res.status).toBe(200);
    expect(await composition(ids.Aresume)).toEqual([ids.Askills]);
    await callRoute(resume.PATCH, { method: 'PATCH', url: `/api/resumes/${ids.Aresume}`, params: { id: ids.Aresume }, body: { sections: [ids.Askills, ids.Aheader] } });
    expect(await composition(ids.Aresume)).toEqual([ids.Askills, ids.Aheader]);
  });

  it('exports the composed resume as HTML and TeX', async () => {
    asA();
    const html = await callRoute(exp.GET, { url: `/api/resumes/export?id=${ids.Aresume}` });
    expect(html.text).toContain('A Person');
    const tex = await callRoute(exp.GET, { url: `/api/resumes/export?id=${ids.Aresume}&format=tex` });
    expect(tex.text).toContain('A-lang');
  });

  it('editing a variant refreshes the text cache of resumes that use it', async () => {
    asA();
    await callRoute(section.PATCH, { method: 'PATCH', url: `/api/sections/${ids.Askills}`, params: { id: ids.Askills }, body: { data: { categories: [{ category: 'Langs', items: 'Zig' }] } } });
    expect((await row('resumes', ids.Aresume))!.content).toContain('Zig');
  });

  it('analytics counts only the caller’s applications', async () => {
    asA();
    const res = await callRoute(analytics.GET, { url: '/api/analytics' });
    expect(res.json.overall.total_applications).toBe(1);
    expect(res.json.by_version.every((v: any) => v.user_id === A.id)).toBe(true);
  });
});

describe('user A cannot read or modify user B’s data through the API', () => {
  it('lists contain none of B’s rows', async () => {
    asA();
    const all = JSON.stringify([
      (await callRoute(resumes.GET, { url: '/api/resumes' })).json,
      (await callRoute(sections.GET, { url: '/api/sections' })).json,
      (await callRoute(apps.GET, { url: '/api/applications' })).json,
      (await callRoute(ivs.GET, { url: '/api/interviews' })).json,
      (await callRoute(analytics.GET, { url: '/api/analytics' })).json,
    ]);
    for (const k of ['Bresume', 'Bheader', 'Bskills', 'Bapp', 'Biv']) expect(all).not.toContain(ids[k]);
    expect(all).not.toContain('B Corp');
  });

  it('GET resume, export and match by B’s id all 404', async () => {
    asA();
    expect((await callRoute(resume.GET, { url: `/api/resumes/${ids.Bresume}`, params: { id: ids.Bresume } })).status).toBe(404);
    expect((await callRoute(exp.GET, { url: `/api/resumes/export?id=${ids.Bresume}&format=tex` })).status).toBe(404);
    const m = await callRoute(match.POST, { method: 'POST', url: '/api/resumes/match', body: { job_text: 'B Person skills and B-lang required here', resume_id: ids.Bresume } });
    expect(m.status).toBe(404);
  });

  it('PATCH/DELETE of B’s resume changes nothing', async () => {
    asA();
    const before = await row('resumes', ids.Bresume);
    const p = await callRoute(resume.PATCH, { method: 'PATCH', url: `/api/resumes/${ids.Bresume}`, params: { id: ids.Bresume }, body: { name: 'pwned' } });
    expect(p.status).toBe(404);
    const s = await callRoute(resume.PATCH, { method: 'PATCH', url: `/api/resumes/${ids.Bresume}`, params: { id: ids.Bresume }, body: { sections: [ids.Aheader] } });
    expect(s.status).toBeGreaterThanOrEqual(400);
    await callRoute(resume.DELETE, { method: 'DELETE', url: `/api/resumes/${ids.Bresume}`, params: { id: ids.Bresume } });
    expect(await row('resumes', ids.Bresume)).toEqual(before);
    expect(await composition(ids.Bresume)).toEqual([ids.Bheader, ids.Bskills]);
  });

  it('PATCH/DELETE of B’s section variant changes nothing', async () => {
    asA();
    const before = await row('section_variants', ids.Bheader);
    expect((await callRoute(section.PATCH, { method: 'PATCH', url: `/api/sections/${ids.Bheader}`, params: { id: ids.Bheader }, body: { label: 'pwned' } })).status).toBe(404);
    await callRoute(section.DELETE, { method: 'DELETE', url: `/api/sections/${ids.Bheader}`, params: { id: ids.Bheader } });
    expect(await row('section_variants', ids.Bheader)).toEqual(before);
  });

  it('PATCH/DELETE of B’s application and interview changes nothing', async () => {
    asA();
    const appBefore = await row('applications', ids.Bapp);
    const ivBefore = await row('interviews', ids.Biv);
    const pa = await callRoute(app.PATCH, { method: 'PATCH', url: `/api/applications/${ids.Bapp}`, params: { id: ids.Bapp }, body: { status: 'offer' } });
    expect(pa.status).toBeGreaterThanOrEqual(400);
    const pi = await callRoute(iv.PATCH, { method: 'PATCH', url: `/api/interviews/${ids.Biv}`, params: { id: ids.Biv }, body: { notes: 'pwned' } });
    expect(pi.status).toBeGreaterThanOrEqual(400);
    await callRoute(app.DELETE, { method: 'DELETE', url: `/api/applications/${ids.Bapp}`, params: { id: ids.Bapp } });
    await callRoute(iv.DELETE, { method: 'DELETE', url: `/api/interviews/${ids.Biv}`, params: { id: ids.Biv } });
    expect(await row('applications', ids.Bapp)).toEqual(appBefore);
    expect(await row('interviews', ids.Biv)).toEqual(ivBefore);
  });

  it('cannot create rows that link to B’s data', async () => {
    asA();
    const a1 = await callRoute(apps.POST, { method: 'POST', url: '/api/applications', body: { company: 'x', resume_id: ids.Bresume } });
    expect(a1.status).toBeGreaterThanOrEqual(400);
    const i1 = await callRoute(ivs.POST, { method: 'POST', url: '/api/interviews', body: { application_id: ids.Bapp } });
    expect(i1.status).toBeGreaterThanOrEqual(400);
    const filtered = await callRoute(apps.GET, { url: `/api/applications?resume_id=${ids.Bresume}` });
    expect(filtered.json.applications).toEqual([]);
  });

  it('cannot read B’s data through the interview filter', async () => {
    asA();
    expect((await callRoute(ivs.GET, { url: `/api/interviews?application_id=${ids.Bapp}` })).json.interviews).toEqual([]);
  });
});

describe('composition integrity', () => {
  // BUG: setComposition deleted the existing rows before inserting the new ones.
  // If the insert is rejected — a variant id that is someone else's, or one the
  // user deleted in another tab — the resume silently lost every section.
  it('a PATCH with a foreign variant id leaves the existing composition intact', async () => {
    asA();
    const before = await composition(ids.Aresume);
    expect(before.length).toBeGreaterThan(0);
    const res = await callRoute(resume.PATCH, {
      method: 'PATCH',
      url: `/api/resumes/${ids.Aresume}`,
      params: { id: ids.Aresume },
      body: { sections: [ids.Aheader, ids.Bheader] },
    });
    expect(res).toMatchObject({ status: 400, json: { error: 'One or more sections no longer exist' } });
    expect(await composition(ids.Aresume)).toEqual(before);
  });

  it('a PATCH with a since-deleted variant id leaves the existing composition intact', async () => {
    asA();
    const tmp = await callRoute(sections.POST, { method: 'POST', url: '/api/sections', body: { kind: 'skills', label: 'tmp' } });
    await callRoute(section.DELETE, { method: 'DELETE', url: `/api/sections/${tmp.json.variant.id}`, params: { id: tmp.json.variant.id } });
    await callRoute(resume.PATCH, { method: 'PATCH', url: `/api/resumes/${ids.Aresume}`, params: { id: ids.Aresume }, body: { sections: [ids.Aheader, ids.Askills] } });
    const before = await composition(ids.Aresume);
    expect(before).toEqual([ids.Aheader, ids.Askills]);
    const res = await callRoute(resume.PATCH, {
      method: 'PATCH',
      url: `/api/resumes/${ids.Aresume}`,
      params: { id: ids.Aresume },
      body: { sections: [tmp.json.variant.id] },
    });
    expect(res).toMatchObject({ status: 400, json: { error: 'One or more sections no longer exist' } });
    expect(await composition(ids.Aresume)).toEqual(before);
  });

  it('deleting a variant cascades it out of compositions and refreshes the cache', async () => {
    asA();
    const r = await callRoute(resumes.POST, { method: 'POST', url: '/api/resumes', body: { name: 'cascade', sections: [ids.Aheader, ids.Askills] } });
    const v = await callRoute(sections.POST, { method: 'POST', url: '/api/sections', body: { kind: 'coursework', label: 'c', data: { courses: ['Topology'] } } });
    await callRoute(resume.PATCH, { method: 'PATCH', url: `/api/resumes/${r.json.resume.id}`, params: { id: r.json.resume.id }, body: { sections: [ids.Aheader, v.json.variant.id] } });
    expect((await row('resumes', r.json.resume.id))!.content).toContain('Topology');
    await callRoute(section.DELETE, { method: 'DELETE', url: `/api/sections/${v.json.variant.id}`, params: { id: v.json.variant.id } });
    expect(await composition(r.json.resume.id)).toEqual([ids.Aheader]);
    expect((await row('resumes', r.json.resume.id))!.content).not.toContain('Topology');
  });

  it('deleting a resume keeps its applications but unlinks them', async () => {
    asA();
    const r = await callRoute(resumes.POST, { method: 'POST', url: '/api/resumes', body: { name: 'to delete' } });
    const ap = await callRoute(apps.POST, { method: 'POST', url: '/api/applications', body: { company: 'Keep', resume_id: r.json.resume.id } });
    await callRoute(resume.DELETE, { method: 'DELETE', url: `/api/resumes/${r.json.resume.id}`, params: { id: r.json.resume.id } });
    expect((await row('applications', ap.json.application.id))!.resume_id).toBeNull();
  });
});
