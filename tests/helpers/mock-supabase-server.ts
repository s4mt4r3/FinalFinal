// Stand-in for `@/lib/supabase-server` in route tests:
//   vi.mock('@/lib/supabase-server', () => import('../helpers/mock-supabase-server'));
// AuthError must be the real class because errorResponse() maps it via instanceof.
import { vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const actual = await vi.importActual<typeof import('@/lib/supabase-server')>('@/lib/supabase-server');

export const AuthError = actual.AuthError;

type Session = { user: { id: string; email?: string }; supabase: SupabaseClient<any> };
let current: Session | null = null;
let failure: unknown = null;

export function signInAs(user: Session['user'], supabase: SupabaseClient<any>) {
  current = { user, supabase };
  failure = null;
}

export function signOut() {
  current = null;
  failure = null;
}

// Simulates getCurrentUser() itself blowing up (e.g. cookies() unavailable).
export function failAuthWith(err: unknown) {
  failure = err;
}

export const getCurrentUser = vi.fn(async () => {
  if (failure) throw failure;
  if (!current) throw new AuthError('Not authenticated');
  return current;
});

export const createSupabaseServerClient = vi.fn(async () => {
  if (!current) throw new Error('createSupabaseServerClient called without a mocked session');
  return current.supabase;
});
