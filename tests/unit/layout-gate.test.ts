import { beforeEach, describe, expect, it, vi } from 'vitest';

// The redirect logic lives in the root layout (middleware only refreshes the
// session and forwards x-pathname), so this is where auth gating is tested.
const state = vi.hoisted(() => ({ pathname: null as string | null, user: null as unknown, getUser: vi.fn() }));

vi.mock('next/headers', () => ({
  headers: async () => new Headers(state.pathname === null ? {} : { 'x-pathname': state.pathname }),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((to: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { to });
  }),
}));
vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: state.getUser } }),
}));

import RootLayout from '@/app/layout';

async function render(pathname: string | null, user: unknown) {
  state.pathname = pathname;
  state.getUser.mockResolvedValue({ data: { user }, error: null });
  try {
    await RootLayout({ children: 'child' });
    return { redirectedTo: null };
  } catch (e: any) {
    if (e.message === 'NEXT_REDIRECT') return { redirectedTo: e.to as string };
    throw e;
  }
}

const USER = { id: 'u1', email: 'a@b.c' };

describe('root layout auth gate', () => {
  beforeEach(() => state.getUser.mockReset());

  it.each(['/login', '/demo', '/privacy', '/tos', '/api/auth/callback', '/api/auth/signout'])(
    'serves public route %s to anonymous visitors without an auth lookup',
    async (p) => {
      expect(await render(p, null)).toEqual({ redirectedTo: null });
      expect(state.getUser).not.toHaveBeenCalled();
    }
  );

  it.each(['/', '/dashboard', '/anything/else', '/loginx', '/demo/extra', '/privacy-policy'])(
    'redirects anonymous visitors on protected route %s to /login',
    async (p) => {
      expect(await render(p, null)).toEqual({ redirectedTo: '/login' });
    }
  );

  it('lets signed-in users through protected routes', async () => {
    expect(await render('/', USER)).toEqual({ redirectedTo: null });
    expect(state.getUser).toHaveBeenCalledTimes(1);
  });

  it('treats a missing x-pathname as protected (fails closed)', async () => {
    expect(await render(null, null)).toEqual({ redirectedTo: '/login' });
  });

  it('redirects when Supabase reports an auth error with no user', async () => {
    state.pathname = '/';
    state.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'jwt expired' } });
    await expect(RootLayout({ children: 'x' })).rejects.toMatchObject({ to: '/login' });
  });
});
