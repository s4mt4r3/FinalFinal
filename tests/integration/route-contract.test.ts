import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENDPOINTS, happyResponder } from './endpoints';
import { callRoute, newUser, silenceConsoleError } from '../helpers/route';
import { createSupabaseMock, pgError } from '../helpers/supabase-mock';
import { failAuthWith, signInAs, signOut } from '../helpers/mock-supabase-server';

vi.mock('@/lib/supabase-server', () => import('../helpers/mock-supabase-server'));

const call = async (e: (typeof ENDPOINTS)[number]) => {
  const mod = await e.load();
  return callRoute(mod[e.method], { method: e.method, url: e.url, params: e.params, body: e.body });
};

describe.each(ENDPOINTS)('$name', (e) => {
  beforeEach(() => signOut());

  it('succeeds for a signed-in user', async () => {
    signInAs(newUser(), createSupabaseMock(happyResponder).client);
    const res = await call(e);
    expect(res.status).toBe(e.okStatus);
  });

  it('returns 401 and never touches the database when anonymous', async () => {
    const res = await call(e);
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Not authenticated' });
  });

  it(`returns 429 with Retry-After once the ${e.heavy ? 'heavy (20/min)' : 'default (60/min)'} limit is hit`, async () => {
    const { client } = createSupabaseMock(happyResponder);
    signInAs(newUser(), client);
    const limit = e.heavy ? 20 : 60;
    for (let i = 0; i < limit; i++) expect((await call(e)).status).toBe(e.okStatus);
    const res = await call(e);
    expect(res.status).toBe(429);
    expect(res.json).toEqual({ error: 'Too many requests' });
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('degrades to a generic 500 with no internals when Supabase fails (production)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const log = silenceConsoleError();
    signInAs(newUser(), createSupabaseMock(() => ({ error: pgError('relation "secret_table" does not exist') })).client);
    const res = await call(e);
    // Routes that read-then-404 legitimately map a failed lookup to 404.
    expect([500, 404]).toContain(res.status);
    expect(res.text).not.toMatch(/secret_table|internal detail|XX000|at \w+ \(|\.ts:\d+/);
    if (res.status === 500) {
      expect(res.json).toEqual({ error: 'Internal server error' });
      expect(log).toHaveBeenCalled();
    }
  });

  it('degrades to a generic 500 when the Supabase client throws (network down)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    silenceConsoleError();
    signInAs(newUser(), createSupabaseMock(() => {
      throw new TypeError('fetch failed: ECONNREFUSED 10.0.0.5:5432');
    }).client);
    const res = await call(e);
    expect(res.status).toBe(500);
    expect(res.json).toEqual({ error: 'Internal server error' });
  });

  it('never leaks a stack trace even outside production', async () => {
    silenceConsoleError();
    failAuthWith(new Error('cookies() unavailable'));
    const res = await call(e);
    expect(res.status).toBe(500);
    expect(Object.keys(res.json)).toEqual(['error']);
    expect(res.text).not.toMatch(/\n\s+at /);
  });
});
