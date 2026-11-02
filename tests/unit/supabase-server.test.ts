import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server, SUPABASE_URL } from '../helpers/msw';
import { gotrue, session, sessionCookie, testUser } from '../helpers/supabase-session';

const jar = vi.hoisted(() => ({
  cookies: [] as { name: string; value: string }[],
  setThrows: false,
  set: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => jar.cookies,
    set: (...args: unknown[]) => {
      if (jar.setThrows) throw new Error('Cookies can only be modified in a Server Action or Route Handler');
      jar.set(...args);
    },
  }),
}));

import { AuthError, getCurrentUser } from '@/lib/supabase-server';

describe('getCurrentUser', () => {
  beforeEach(() => {
    jar.cookies = [];
    jar.setThrows = false;
    jar.set.mockReset();
  });

  it('throws AuthError (→ 401) when there is no session cookie', async () => {
    await expect(getCurrentUser()).rejects.toBeInstanceOf(AuthError);
  });

  it('returns the Supabase-verified user, not the one embedded in the cookie', async () => {
    const cookieUser = testUser({ email: 'cookie@example.com' });
    const verified = { ...cookieUser, email: 'verified@example.com' };
    jar.cookies = [sessionCookie(session(cookieUser))];
    server.use(gotrue.user(verified));
    const { user, supabase } = await getCurrentUser();
    expect(user.email).toBe('verified@example.com');
    expect(typeof supabase.from).toBe('function');
  });

  it('rejects a forged/revoked token that Supabase refuses', async () => {
    jar.cookies = [sessionCookie(session())];
    server.use(gotrue.userUnauthorized());
    await expect(getCurrentUser()).rejects.toThrow('Not authenticated');
  });

  it('maps a Supabase outage to AuthError rather than a 500 with internals', async () => {
    jar.cookies = [sessionCookie(session())];
    server.use(http.get(`${SUPABASE_URL}/auth/v1/user`, () => HttpResponse.error()));
    await expect(getCurrentUser()).rejects.toBeInstanceOf(AuthError);
  });

  it('refreshes an expired token and tolerates read-only cookies (Server Component context)', async () => {
    const user = testUser();
    jar.cookies = [sessionCookie(session(user, { expiresInSec: -60 }))];
    jar.setThrows = true;
    server.use(gotrue.refresh(session(user)), gotrue.user(user));
    await expect(getCurrentUser()).resolves.toMatchObject({ user: { id: user.id } });
  });

  it('persists refreshed cookies when the context allows writes (Route Handler)', async () => {
    const user = testUser();
    jar.cookies = [sessionCookie(session(user, { expiresInSec: -60 }))];
    server.use(gotrue.refresh(session(user)), gotrue.user(user));
    await getCurrentUser();
    expect(jar.set).toHaveBeenCalled();
  });
});
