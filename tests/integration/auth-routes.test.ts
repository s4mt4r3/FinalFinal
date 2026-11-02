import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { createServerClient } from '@supabase/ssr';
import { GET as callback } from '@/app/api/auth/callback/route';
import { POST as signout } from '@/app/api/auth/signout/route';
import { GET as listResumes } from '@/app/api/resumes/route';
import { server, SUPABASE_URL } from '../helpers/msw';
import { AUTH_COOKIE, gotrue, session, sessionCookie, testUser } from '../helpers/supabase-session';
import { callRoute } from '../helpers/route';

const jar = vi.hoisted(() => ({ cookies: new Map<string, string>() }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => [...jar.cookies].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => jar.cookies.set(name, value),
  }),
}));

// Start a real PKCE flow so the code-verifier cookie is exactly what
// @supabase/ssr would have written in the browser.
async function startPkce() {
  const sb = createServerClient(SUPABASE_URL, 'k', {
    cookies: {
      getAll: () => [...jar.cookies].map(([name, value]) => ({ name, value })),
      setAll: (cs) => cs.forEach((c) => jar.cookies.set(c.name, c.value)),
    },
  });
  await sb.auth.signInWithOAuth({ provider: 'google', options: { skipBrowserRedirect: true, redirectTo: 'http://localhost:3000/api/auth/callback' } });
  expect([...jar.cookies.keys()].some((k) => k.endsWith('-code-verifier'))).toBe(true);
}

function exchangeSucceeds(user = testUser()) {
  const seen: any[] = [];
  server.use(
    http.post(`${SUPABASE_URL}/auth/v1/token`, async ({ request }) => {
      const grant = new URL(request.url).searchParams.get('grant_type');
      seen.push({ grant, body: await request.json() });
      return HttpResponse.json(session(user));
    })
  );
  return seen;
}

const cb = (qs: string) => callback(new Request(`http://localhost:3000/api/auth/callback${qs}`));

describe('GET /api/auth/callback (Google OAuth + email magic link)', () => {
  beforeEach(() => jar.cookies.clear());

  it('redirects to /login?error=missing_code without a code', async () => {
    const res = await cb('');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login?error=missing_code');
  });

  it('exchanges the code with the stored PKCE verifier and sets the session cookie on the redirect', async () => {
    await startPkce();
    const seen = exchangeSucceeds();
    const res = await cb('?code=auth-code-123');
    expect(seen).toEqual([{ grant: 'pkce', body: { auth_code: 'auth-code-123', code_verifier: expect.any(String) } }]);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
    expect(res.headers.get('set-cookie')).toContain(`${AUTH_COOKIE}=base64-`);
  });

  it('honours a same-origin relative `next` path', async () => {
    await startPkce();
    exchangeSucceeds();
    expect((await cb('?code=c&next=/settings')).headers.get('location')).toBe('http://localhost:3000/settings');
  });

  it('sends the user back to /login with an encoded error when the exchange fails', async () => {
    await startPkce();
    server.use(http.post(`${SUPABASE_URL}/auth/v1/token`, () => HttpResponse.json({ error_code: 'flow_state_expired', msg: 'Flow state expired & gone' }, { status: 400 })));
    const res = await cb('?code=stale');
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/login');
    expect(loc.searchParams.get('error')).toBeTruthy();
    expect(res.headers.get('set-cookie') ?? '').not.toContain(`${AUTH_COOKIE}=base64-`);
  });

  it('fails without a session when the verifier cookie is missing (different browser)', async () => {
    exchangeSucceeds();
    const loc = new URL((await cb('?code=c')).headers.get('location')!);
    expect(loc.pathname).toBe('/login');
  });

  // BUG: the route builds `${origin}${next}`. With next="@evil.example" that is
  // "http://localhost:3000@evil.example" — userinfo + a foreign host — so a
  // crafted sign-in link lands a freshly authenticated user on an attacker site.
  it.each(['@evil.example', '.evil.example', '//evil.example', '/\\evil.example', 'https://evil.example'])(
    'never redirects off-origin (next=%s)',
    async (next) => {
      await startPkce();
      exchangeSucceeds();
      const res = await cb(`?code=c&next=${encodeURIComponent(next)}`);
      const loc = new URL(res.headers.get('location')!, 'http://localhost:3000');
      expect(loc.origin).toBe('http://localhost:3000');
      expect(loc.username).toBe('');
    }
  );
});

describe('POST /api/auth/signout', () => {
  beforeEach(() => jar.cookies.clear());

  it('revokes the session with Supabase and clears the auth cookie', async () => {
    const s = session();
    const c = sessionCookie(s);
    jar.cookies.set(c.name, c.value);
    let revoked = false;
    server.use(gotrue.user(s.user), http.post(`${SUPABASE_URL}/auth/v1/logout`, () => ((revoked = true), new HttpResponse(null, { status: 204 }))));
    const res = await signout();
    expect(await res.json()).toEqual({ success: true });
    expect(revoked).toBe(true);
    expect(jar.cookies.get(AUTH_COOKIE) ?? '').toBe('');
  });

  it('succeeds for an already signed-out visitor', async () => {
    expect(await (await signout()).json()).toEqual({ success: true });
  });
});

describe('session expiry through the real route() wrapper', () => {
  beforeEach(() => jar.cookies.clear());

  it('transparently refreshes an expired access token', async () => {
    const user = testUser();
    const c = sessionCookie(session(user, { expiresInSec: -10 }));
    jar.cookies.set(c.name, c.value);
    server.use(gotrue.refresh(session(user)), gotrue.user(user), http.get(`${SUPABASE_URL}/rest/v1/resumes`, () => HttpResponse.json([])));
    const res = await callRoute(listResumes, { url: '/api/resumes' });
    expect(res.status).toBe(200);
    expect(jar.cookies.get(AUTH_COOKIE)).not.toBe(c.value);
  });

  it('returns 401 when the refresh token has been revoked', async () => {
    const c = sessionCookie(session(testUser(), { expiresInSec: -10 }));
    jar.cookies.set(c.name, c.value);
    server.use(http.post(`${SUPABASE_URL}/auth/v1/token`, () => HttpResponse.json({ error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' }, { status: 400 })));
    expect((await callRoute(listResumes, { url: '/api/resumes' })).status).toBe(401);
  });

  it('returns 401 for a garbage cookie', async () => {
    jar.cookies.set(AUTH_COOKIE, 'base64-!!!notjson');
    expect((await callRoute(listResumes, { url: '/api/resumes' })).status).toBe(401);
  });
});
