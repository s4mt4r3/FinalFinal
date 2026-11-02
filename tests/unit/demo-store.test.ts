import { beforeEach, describe, expect, it } from 'vitest';
import { demoApi, resetDemoStore } from '@/lib/demo-store';

// MSW is listening with onUnhandledRequest: 'error', so any network call the
// demo store made would fail these tests — "nothing is ever written" is enforced.
describe('demo store', () => {
  beforeEach(() => resetDemoStore());

  it('seeds sample resumes, variants, applications and interviews', async () => {
    const resumes = await demoApi.resumes.list();
    expect(resumes.length).toBeGreaterThanOrEqual(2);
    expect(resumes.every((r) => r.user_id === 'demo')).toBe(true);
    expect((await demoApi.sections.list()).length).toBeGreaterThanOrEqual(7);
    expect((await demoApi.applications.list()).length).toBeGreaterThan(0);
    expect((await demoApi.interviews.list()).length).toBeGreaterThan(0);
  });

  it('lists resumes newest first', async () => {
    const r = await demoApi.resumes.list();
    const times = r.map((x) => +new Date(x.created_at));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('creates a resume with an ordered composition and a regenerated text cache', async () => {
    const vars = await demoApi.sections.list();
    const header = vars.find((v) => v.kind === 'header')!;
    const skills = vars.find((v) => v.kind === 'skills')!;
    const created = await demoApi.resumes.create({ name: 'Mine', sections: [skills.id, header.id] } as any);
    expect(created.sections.map((v) => v.id)).toEqual([skills.id, header.id]);
    const { resume } = await demoApi.resumes.get(created.id);
    expect(resume.content).toContain('TECHNICAL SKILLS');
    expect(resume.content).toContain((header.data as any).name);
  });

  it('reorders and removes sections on update', async () => {
    const [r] = await demoApi.resumes.list();
    const { resume } = await demoApi.resumes.get(r.id);
    const ids = resume.sections.map((v) => v.id);
    const reordered = [...ids].reverse().slice(0, ids.length - 1);
    const updated = await demoApi.resumes.update(r.id, { sections: reordered });
    expect(updated.sections.map((v) => v.id)).toEqual(reordered);
    expect((await demoApi.resumes.get(r.id)).resume.sections.map((v) => v.id)).toEqual(reordered);
  });

  it('updates only provided metadata fields', async () => {
    const [r] = await demoApi.resumes.list();
    const updated = await demoApi.resumes.update(r.id, { name: 'Renamed' });
    expect(updated.name).toBe('Renamed');
    expect(updated.tags).toEqual(r.tags);
    expect(updated.sections.length).toBeGreaterThan(0);
  });

  it('deleting a resume detaches (not deletes) its applications', async () => {
    const apps = await demoApi.applications.list();
    const linked = apps.find((a) => a.resume_id)!;
    await demoApi.resumes.delete(linked.resume_id!);
    const after = (await demoApi.applications.list()).find((a) => a.id === linked.id)!;
    expect(after.resume_id).toBeNull();
    await expect(demoApi.resumes.get(linked.resume_id!)).rejects.toThrow('Not found');
  });

  it('deleting a variant drops it from every composition and refreshes their text', async () => {
    const [r] = await demoApi.resumes.list();
    const { resume } = await demoApi.resumes.get(r.id);
    const victim = resume.sections.find((v) => v.kind === 'skills')!;
    await demoApi.sections.delete(victim.id);
    const after = (await demoApi.resumes.get(r.id)).resume;
    expect(after.sections.find((v) => v.id === victim.id)).toBeUndefined();
    expect(after.content).not.toContain('TECHNICAL SKILLS');
  });

  it('creates, filters, updates and deletes sections', async () => {
    const v = await demoApi.sections.create({ kind: 'skills', label: 'New' } as any);
    expect(v.data).toEqual({});
    expect((await demoApi.sections.list('skills')).map((x) => x.id)).toContain(v.id);
    expect((await demoApi.sections.list('header')).map((x) => x.id)).not.toContain(v.id);
    const u = await demoApi.sections.update(v.id, { label: 'Renamed', data: { categories: [] } });
    expect(u).toMatchObject({ label: 'Renamed', data: { categories: [] } });
    await expect(demoApi.sections.update('nope', { label: 'x' })).rejects.toThrow('Not found');
  });

  it('filters applications by status, resume and search; deleting cascades interviews', async () => {
    const apps = await demoApi.applications.list();
    const withInterviews = new Set((await demoApi.interviews.list()).map((i) => i.application_id));
    const target = apps.find((a) => withInterviews.has(a.id))!;
    expect((await demoApi.applications.list({ status: target.status })).every((a) => a.status === target.status)).toBe(true);
    expect((await demoApi.applications.list({ search: target.company.slice(0, 3).toUpperCase() })).map((a) => a.id)).toContain(target.id);
    if (target.resume_id) {
      expect((await demoApi.applications.list({ resume_id: target.resume_id })).every((a) => a.resume_id === target.resume_id)).toBe(true);
    }
    const before = (await demoApi.interviews.list(target.id)).length;
    expect(before).toBeGreaterThan(0);
    await demoApi.applications.delete(target.id);
    expect(await demoApi.interviews.list(target.id)).toEqual([]);
  });

  it('application create/update fills defaults and applies patches', async () => {
    const a = await demoApi.applications.create({ company: 'Acme' } as any);
    expect(a).toMatchObject({ company: 'Acme', status: 'applied', notes: '', resume_id: null, role: null });
    const u = await demoApi.applications.update(a.id, { status: 'offer', role: 'Eng', notes: 'n', company: 'Acme2', resume_id: null, date_applied: '2026-01-01T00:00:00.000Z' });
    expect(u).toMatchObject({ status: 'offer', role: 'Eng', company: 'Acme2' });
    await expect(demoApi.applications.update('nope', {})).rejects.toThrow('Not found');
  });

  it('interview CRUD', async () => {
    const [app] = await demoApi.applications.list();
    const i = await demoApi.interviews.create({ application_id: app.id } as any);
    expect(i).toMatchObject({ kind: null, outcome: null, notes: '' });
    const u = await demoApi.interviews.update(i.id, { kind: 'Onsite', outcome: 'passed', notes: 'ok', scheduled_at: '2026-01-01T00:00:00.000Z' });
    expect(u).toMatchObject({ kind: 'Onsite', outcome: 'passed' });
    await demoApi.interviews.delete(i.id);
    expect((await demoApi.interviews.list()).find((x) => x.id === i.id)).toBeUndefined();
    await expect(demoApi.interviews.update('nope', {})).rejects.toThrow('Not found');
  });

  it('renders html and tex, and keyword-matches against stored content or raw text', async () => {
    const [r] = await demoApi.resumes.list();
    expect(await demoApi.resumes.render(r.id, 'html', 0.9)).toContain('font-size: 9.540pt');
    expect(await demoApi.resumes.render(r.id, 'tex', 1)).toContain('\\begin{document}');
    await expect(demoApi.resumes.render('nope', 'html', 1)).rejects.toThrow('Not found');

    const byId = await demoApi.resumes.matchKeywords({ resume_id: r.id, job_text: 'We need TypeScript and React and Kubernetes' });
    expect(byId.all_keywords.length).toBeGreaterThan(0);
    const byText = await demoApi.resumes.matchKeywords({ resume_text: 'kubernetes', job_text: 'Kubernetes experience required' });
    expect(byText.matched).toContain('kubernetes');
    await expect(demoApi.resumes.matchKeywords({ resume_id: 'nope', job_text: 'x' })).rejects.toThrow('Not found');
  });

  it('computes analytics consistent with the applications', async () => {
    const apps = await demoApi.applications.list();
    const { overall, by_version } = await demoApi.analytics.get();
    expect(overall.total_applications).toBe(apps.length);
    expect(overall.offers).toBe(apps.filter((a) => a.status === 'offer').length);
    const rates = by_version.map((v) => v.callback_rate_pct);
    expect([...rates].sort((a, b) => b - a)).toEqual(rates);
  });

  it('reset discards every change', async () => {
    await demoApi.resumes.create({ name: 'Temp' } as any);
    const before = (await demoApi.resumes.list()).length;
    resetDemoStore();
    expect((await demoApi.resumes.list()).length).toBe(before - 1);
    expect((await demoApi.resumes.list()).find((r) => r.name === 'Temp')).toBeUndefined();
  });

  it('sign-out is a local no-op', async () => {
    expect(await demoApi.auth.signOut()).toEqual({ success: true });
  });
});
