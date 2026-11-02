import { describe, expect, it, vi } from 'vitest';
import * as exp from '@/app/api/resumes/export/route';
import * as match from '@/app/api/resumes/match/route';
import { callRoute, newUser } from '../helpers/route';
import { createSupabaseMock, type Responder } from '../helpers/supabase-mock';
import { signInAs } from '../helpers/mock-supabase-server';
import { ID } from './endpoints';
import { texBraceBalance, variant } from '../helpers/fixtures';

vi.mock('@/lib/supabase-server', () => import('../helpers/mock-supabase-server'));

function as(respond: Responder) {
  const m = createSupabaseMock(respond);
  signInAs(newUser(), m.client);
  return m;
}

const owned: Responder = (q) => {
  if (q.table === 'resumes') return { data: { id: ID } };
  if (q.table === 'resume_sections') return { data: [{ variant_id: 'h', position: 0 }, { variant_id: 'e', position: 1 }] };
  if (q.table === 'section_variants') return { data: [variant('experience', { id: 'e' }), variant('header', { id: 'h' })] };
};

describe('GET /api/resumes/export', () => {
  it('renders HTML by default with private, no-store caching', async () => {
    as(owned);
    const res = await callRoute(exp.GET, { url: `/api/resumes/export?id=${ID}` });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.text).toContain('Ada Lovelace');
    expect(res.text).toContain('Analytical Engines Ltd');
    expect(res.text).toContain('font-size: 10.600pt');
  });

  it('honours scale within 0.5–1 and rejects values outside it', async () => {
    as(owned);
    expect((await callRoute(exp.GET, { url: `/api/resumes/export?id=${ID}&scale=0.75` })).text).toContain('font-size: 7.950pt');
    expect((await callRoute(exp.GET, { url: `/api/resumes/export?id=${ID}&scale=0.4` })).status).toBe(400);
    expect((await callRoute(exp.GET, { url: `/api/resumes/export?id=${ID}&scale=2` })).status).toBe(400);
    expect((await callRoute(exp.GET, { url: `/api/resumes/export?id=${ID}&scale=abc` })).status).toBe(400);
  });

  it('renders compilable-looking LaTeX for format=tex', async () => {
    as(owned);
    const res = await callRoute(exp.GET, { url: `/api/resumes/export?id=${ID}&format=tex` });
    expect(res.headers.get('content-type')).toBe('application/x-tex; charset=utf-8');
    expect(res.text).toContain('\\begin{document}');
    expect(res.text).toContain('Ada Lovelace');
    expect(texBraceBalance(res.text)).toBe(0);
  });

  it('rejects unknown formats and missing/invalid ids', async () => {
    as(owned);
    for (const qs of [`id=${ID}&format=pdf`, '', 'id=abc']) {
      expect((await callRoute(exp.GET, { url: `/api/resumes/export?${qs}` })).status).toBe(400);
    }
  });

  it('returns 404 and renders nothing for a resume the user cannot see', async () => {
    const m = as(() => ({ data: null }));
    const res = await callRoute(exp.GET, { url: `/api/resumes/export?id=${ID}` });
    expect(res).toMatchObject({ status: 404, json: { error: 'Not found' } });
    expect(m.callsTo('resume_sections')).toHaveLength(0);
  });
});

describe('POST /api/resumes/match', () => {
  const JD = 'Looking for Python, Kubernetes and Terraform experience.';

  it('matches against raw resume_text without a DB read', async () => {
    const m = as(() => undefined);
    const res = await callRoute(match.POST, { method: 'POST', url: '/api/resumes/match', body: { job_text: JD, resume_text: 'python and kubernetes' } });
    expect(res.json.matched).toEqual(expect.arrayContaining(['python', 'kubernetes']));
    expect(res.json.missing).toContain('terraform');
    expect(m.calls).toHaveLength(0);
  });

  it('matches against the stored content cache for resume_id', async () => {
    const m = as(() => ({ data: { content: 'terraform' } }));
    const res = await callRoute(match.POST, { method: 'POST', url: '/api/resumes/match', body: { job_text: JD, resume_id: ID } });
    expect(res.json.matched).toEqual(['terraform']);
    expect(m.calls[0].filters).toContainEqual(['eq', 'id', ID]);
  });

  it('returns 404 for a resume_id the user cannot see', async () => {
    as(() => ({ data: null }));
    const res = await callRoute(match.POST, { method: 'POST', url: '/api/resumes/match', body: { job_text: JD, resume_id: ID } });
    expect(res).toMatchObject({ status: 404, json: { error: 'Resume not found' } });
  });

  it.each([
    [{ job_text: 'short', resume_text: 'x' }],
    [{ job_text: JD }],
    [{ job_text: 'x'.repeat(20_001), resume_text: 'x' }],
    [{ job_text: JD, resume_text: 'x'.repeat(100_001) }],
    [{ job_text: JD, resume_id: 'nope' }],
  ])('returns 400 for %#', async (body) => {
    as(() => undefined);
    expect((await callRoute(match.POST, { method: 'POST', url: '/api/resumes/match', body })).status).toBe(400);
  });
});
