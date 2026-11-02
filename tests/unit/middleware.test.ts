import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { http, HttpResponse, delay } from 'msw';
import { middleware, config } from '@/middleware';
import { server, SUPABASE_URL } from '../helpers/msw';
import { AUTH_COOKIE, gotrue, session, sessionCookie, testUser } from '../helpers/supabase-session';

function request(path: string, cookies: { name: string; value: string }[] = []) {
  const req = new NextRequest(new URL(path, 'http://localhost:3000'));
  for (const c of cookies) req.cookies.set(c.name, c.value);
  return req;
}

describe('middleware: session refresh', () => {
  afterEach(() => vi.useRealTimers());

  it('passes anonymous requests through without calling Supabase', async () => {
    const res = await middleware(request('/'));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(res.headers.get('x-pathname')).toBe('/');
  });

  it('forwards the pathname for the layout gate on every route', async () => {
    for (const p of ['/login', '/demo', '/api/resumes', '/privacy']) {
      expect((await middleware(request(p))).headers.get('x-pathname')).toBe(p);
    }
  });

  it('validates a live session against Supabase and keeps the request flowing', async () => {
    const user = testUser();
    let hits = 0;
    server.use(http.get(`${SUPABASE_URL}/auth/v1/user`, () => (hits++, HttpResponse.json(user))));
    const res = await middleware(request('/', [sessionCookie(session(user))]));
    expect(hits).toBe(1);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-pathname')).toBe('/');
  });

  it('refreshes an expired session and writes the new token cookie onto the response', async () => {
    const user = testUser();
    const expired = session(user, { expiresInSec: -60 });
    const fresh = session(user);
    server.use(gotrue.refresh(fresh), gotrue.user(user));
    const res = await middleware(request('/', [sessionCookie(expired)]));
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${AUTH_COOKIE}=base64-`);
    expect(res.headers.get('x-pathname')).toBe('/');
  });

  // The fix in e7dc34c: a hung GoTrue must not hang the middleware past Vercel's
  // invocation limit. getUser() is raced against a 3 s timer.
  it('gives up on a hung Supabase auth call after 3 s and still serves the request', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    server.use(http.get(`${SUPABASE_URL}/auth/v1/user`, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }));
    let settled = false;
    const pending = middleware(request('/resumes', [sessionCookie(session())])).then((r) => {
      settled = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(2_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const res = await pending;
    expect(res.status).toBe(200);
    expect(res.headers.get('x-pathname')).toBe('/resumes');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('falls through when Supabase is down (network error)', async () => {
    server.use(http.get(`${SUPABASE_URL}/auth/v1/user`, () => HttpResponse.error()));
    const res = await middleware(request('/', [sessionCookie(session())]));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-pathname')).toBe('/');
  });

  it('falls through when Supabase rejects the token', async () => {
    server.use(gotrue.userUnauthorized());
    const res = await middleware(request('/', [sessionCookie(session())]));
    expect(res.status).toBe(200);
  });

  it('skips Supabase entirely when env vars are missing (misconfigured deploy)', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    const res = await middleware(request('/', [sessionCookie(session())]));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-pathname')).toBe('/');
  });

  it('falls through when the Supabase URL is malformed', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'not a url');
    const res = await middleware(request('/'));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-pathname')).toBe('/');
  });
});

describe('middleware: matcher', () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it.each(['/', '/login', '/demo', '/api/resumes', '/api/auth/callback', '/privacy', '/tos', '/some/deep/path'])(
    'runs on %s',
    (p) => expect(matcher.test(p)).toBe(true)
  );

  it.each(['/_next/static/chunks/main.js', '/_next/image', '/favicon.ico', '/logo.png', '/a/b/c.svg', '/img.webp'])(
    'skips static asset %s',
    (p) => expect(matcher.test(p)).toBe(false)
  );
});
