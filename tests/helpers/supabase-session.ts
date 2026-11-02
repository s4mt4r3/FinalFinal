import { randomUUID } from 'node:crypto';
import { http, HttpResponse } from 'msw';
import { SUPABASE_URL } from './msw';

const b64url = (s: string) => Buffer.from(s).toString('base64url');

export function fakeJwt(claims: Record<string, unknown>) {
  return [b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), b64url(JSON.stringify(claims)), 'sig'].join('.');
}

export function testUser(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    aud: 'authenticated',
    role: 'authenticated',
    email: 'user@example.com',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function session(user = testUser(), { expiresInSec = 3600 } = {}) {
  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  return {
    access_token: fakeJwt({ sub: user.id, exp, aud: 'authenticated', role: 'authenticated', email: user.email }),
    token_type: 'bearer',
    expires_in: expiresInSec,
    expires_at: exp,
    refresh_token: `refresh-${randomUUID()}`,
    user,
  };
}

// @supabase/ssr storage key is sb-<first label of the project host>-auth-token
// and values are written as "base64-" + base64url(JSON).
export const AUTH_COOKIE = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

export function sessionCookie(s: ReturnType<typeof session>) {
  return { name: AUTH_COOKIE, value: `base64-${b64url(JSON.stringify(s))}` };
}

export const gotrue = {
  user: (user: unknown) => http.get(`${SUPABASE_URL}/auth/v1/user`, () => HttpResponse.json(user)),
  userUnauthorized: () =>
    http.get(`${SUPABASE_URL}/auth/v1/user`, () =>
      HttpResponse.json({ code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' }, { status: 401 })
    ),
  refresh: (next: ReturnType<typeof session>) =>
    http.post(`${SUPABASE_URL}/auth/v1/token`, ({ request }) =>
      new URL(request.url).searchParams.get('grant_type') === 'refresh_token'
        ? HttpResponse.json(next)
        : HttpResponse.json({ error: 'unexpected grant' }, { status: 400 })
    ),
};
