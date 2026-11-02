import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import pg from 'pg';
import { loadTestEnv } from './test-env';
import { installNextWebSocketPolyfill } from './websocket-polyfill';

installNextWebSocketPolyfill();
const env = loadTestEnv();

export const admin: SupabaseClient<any> = createClient(env.url, env.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const anon = () =>
  createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } }) as SupabaseClient<any>;

export function db() {
  return new pg.Client({ connectionString: env.dbUrl });
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient<any>;
}

const created: string[] = [];

export async function createTestUser(label = 'user'): Promise<TestUser> {
  const email = `${label}-${randomUUID().slice(0, 8)}@rls.test`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('createUser failed');
  created.push(data.user.id);
  const client = anon();
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  return { id: data.user.id, email, password, client };
}

// Deleting the auth user cascades every owned row (all user_id FKs are ON DELETE CASCADE).
export async function deleteTestUsers() {
  while (created.length) await admin.auth.admin.deleteUser(created.pop()!);
}

// The exact cookies @supabase/ssr would set in a browser after sign-in, for
// driving route handlers as a real user.
export async function sessionCookiesFor(u: TestUser): Promise<{ name: string; value: string }[]> {
  const jar = new Map<string, string>();
  const sb = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cs) => cs.forEach((c) => (c.value ? jar.set(c.name, c.value) : jar.delete(c.name))),
    },
  });
  const { error } = await sb.auth.signInWithPassword({ email: u.email, password: u.password });
  if (error) throw error;
  return [...jar].map(([name, value]) => ({ name, value }));
}

export const sampleHeader = { name: 'Test Person', email: 't@example.com' };
