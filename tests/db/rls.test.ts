import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { admin, anon, createTestUser, db, deleteTestUsers, sampleHeader, type TestUser } from '../helpers/local-supabase';

let A: TestUser;
let B: TestUser;

// B's rows, seeded through B's own (RLS-bound) client.
const b = {} as Record<'resume' | 'variant' | 'join' | 'application' | 'interview', string>;
// A's own rows, used for cross-linking attempts.
const a = {} as Record<'resume' | 'variant' | 'application' | 'interview' | 'join', string>;

async function insert(client: SupabaseClient<any>, table: string, row: Record<string, unknown>) {
  const { data, error } = await client.from(table).insert(row).select().single();
  if (error) throw new Error(`${table} seed failed: ${error.message}`);
  return data.id as string;
}

async function seed(u: TestUser, out: Record<string, string>) {
  out.resume = await insert(u.client, 'resumes', { user_id: u.id, name: `${u.email} resume` });
  out.variant = await insert(u.client, 'section_variants', { user_id: u.id, kind: 'header', label: 'H', data: sampleHeader });
  out.join = await insert(u.client, 'resume_sections', { resume_id: out.resume, variant_id: out.variant, position: 0 });
  out.application = await insert(u.client, 'applications', { user_id: u.id, company: 'Acme', resume_id: out.resume });
  out.interview = await insert(u.client, 'interviews', { user_id: u.id, application_id: out.application });
}

const OWNED_TABLES: { table: string; ownerCol: string; key: () => string; update: Record<string, unknown> }[] = [
  { table: 'resumes', ownerCol: 'user_id', key: () => b.resume, update: { name: 'pwned' } },
  { table: 'section_variants', ownerCol: 'user_id', key: () => b.variant, update: { label: 'pwned' } },
  { table: 'applications', ownerCol: 'user_id', key: () => b.application, update: { company: 'pwned' } },
  { table: 'interviews', ownerCol: 'user_id', key: () => b.interview, update: { notes: 'pwned' } },
  { table: 'resume_sections', ownerCol: 'resume_id', key: () => b.join, update: { position: 99 } },
  { table: 'profiles', ownerCol: 'id', key: () => B.id, update: { display_name: 'pwned' } },
];

beforeAll(async () => {
  A = await createTestUser('alice');
  B = await createTestUser('bob');
  await seed(B, b);
  await seed(A, a);
});

afterAll(deleteTestUsers);

const snapshot = async (table: string, id: string) => (await admin.from(table).select('*').eq('id', id).single()).data;

describe('RLS is enabled everywhere', () => {
  it('every table in public has row level security turned on', async () => {
    const c = db();
    await c.connect();
    try {
      const { rows } = await c.query(`
        select c.relname, c.relrowsecurity
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p')`);
      expect(rows.length).toBeGreaterThanOrEqual(7);
      const disabled = rows.filter((r) => !r.relrowsecurity).map((r) => r.relname);
      expect(disabled, `RLS DISABLED on: ${disabled.join(', ')}`).toEqual([]);
    } finally {
      await c.end();
    }
  });

  it('every public view runs with the caller’s permissions (security_invoker)', async () => {
    const c = db();
    await c.connect();
    try {
      const { rows } = await c.query(`
        select c.relname, coalesce(c.reloptions::text, '') as opts
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'v'`);
      const unsafe = rows.filter((r) => !/security_invoker=(true|on)/.test(r.opts)).map((r) => r.relname);
      expect(unsafe, `views bypassing RLS: ${unsafe.join(', ')}`).toEqual([]);
    } finally {
      await c.end();
    }
  });

  it('the resume-files bucket is private', async () => {
    const { data } = await admin.storage.getBucket('resume-files');
    expect(data?.public).toBe(false);
  });
});

describe.each(OWNED_TABLES)('$table: user A vs user B’s rows', ({ table, key, update }) => {
  it('A cannot select B’s row', async () => {
    const { data } = await A.client.from(table).select('*').eq('id', key());
    expect(data).toEqual([]);
  });

  it('A’s unfiltered select returns only A’s own rows', async () => {
    const { data } = await A.client.from(table).select('*');
    expect(data!.map((r: any) => r.id)).not.toContain(key());
  });

  it('A cannot update B’s row', async () => {
    const before = await snapshot(table, key());
    const { data } = await A.client.from(table).update(update).eq('id', key()).select();
    expect(data ?? []).toEqual([]);
    expect(await snapshot(table, key())).toEqual(before);
  });

  it('A cannot delete B’s row', async () => {
    await A.client.from(table).delete().eq('id', key());
    expect(await snapshot(table, key())).not.toBeNull();
  });

  it('anon cannot read it', async () => {
    const { data } = await anon().from(table).select('*');
    expect(data ?? []).toEqual([]);
  });
});

describe('inserts on behalf of someone else are rejected', () => {
  it.each<[string, () => Record<string, unknown>]>([
    ['resumes', () => ({ user_id: B.id, name: 'x' })],
    ['section_variants', () => ({ user_id: B.id, kind: 'skills', label: 'x' })],
    ['applications', () => ({ user_id: B.id, company: 'x' })],
    ['interviews', () => ({ user_id: B.id, application_id: b.application })],
    ['profiles', () => ({ id: A.id, email: 'x@y.z' })],
    ['subscriptions', () => ({ user_id: A.id, tier: 'plus', status: 'active' })],
  ])('%s', async (table, row) => {
    const { error } = await A.client.from(table).insert(row());
    expect(error).not.toBeNull();
  });

  it.each(['resumes', 'section_variants', 'applications'])('anon cannot insert into %s', async (table) => {
    const { error } = await anon().from(table).insert({ user_id: B.id, name: 'x', company: 'x', kind: 'skills', label: 'x' });
    expect(error).not.toBeNull();
  });
});

describe('cross-tenant links are rejected on insert', () => {
  it('cannot attach B’s variant to A’s resume', async () => {
    const { error } = await A.client.from('resume_sections').insert({ resume_id: a.resume, variant_id: b.variant, position: 1 });
    expect(error?.message).toMatch(/row-level security/);
  });

  it('cannot attach A’s variant to B’s resume', async () => {
    const { error } = await A.client.from('resume_sections').insert({ resume_id: b.resume, variant_id: a.variant, position: 1 });
    expect(error?.message).toMatch(/row-level security/);
  });

  it('cannot link an application to B’s resume', async () => {
    const { error } = await A.client.from('applications').insert({ user_id: A.id, company: 'x', resume_id: b.resume });
    expect(error?.message).toMatch(/row-level security/);
  });

  it('cannot attach an interview to B’s application', async () => {
    const { error } = await A.client.from('interviews').insert({ user_id: A.id, application_id: b.application });
    expect(error?.message).toMatch(/row-level security/);
  });

  it('cannot branch a resume off B’s resume', async () => {
    const { error } = await A.client.from('resumes').insert({ user_id: A.id, name: 'x', parent_id: b.resume });
    expect(error?.message).toMatch(/row-level security/);
  });
});

// The UPDATE policies originally only re-checked user_id, so a user could
// re-point their own row at someone else's resume/application/variant
// (fixed in migration 0009).
describe('cross-tenant links are rejected on update', () => {
  it('cannot re-point A’s application at B’s resume', async () => {
    const { error } = await A.client.from('applications').update({ resume_id: b.resume }).eq('id', a.application);
    expect(error?.message).toMatch(/row-level security/);
  });

  it('cannot re-point A’s interview at B’s application', async () => {
    const { error } = await A.client.from('interviews').update({ application_id: b.application }).eq('id', a.interview);
    expect(error?.message).toMatch(/row-level security/);
  });

  it('cannot re-point A’s composition row at B’s variant', async () => {
    const { error } = await A.client.from('resume_sections').update({ variant_id: b.variant }).eq('id', a.join);
    expect(error?.message).toMatch(/row-level security/);
  });

  it('cannot re-parent A’s resume under B’s resume', async () => {
    const { error } = await A.client.from('resumes').update({ parent_id: b.resume }).eq('id', a.resume);
    expect(error?.message).toMatch(/row-level security/);
  });

  it('cannot hand a row over to B by rewriting user_id', async () => {
    const { error } = await A.client.from('section_variants').update({ user_id: B.id }).eq('id', a.variant);
    expect(error?.message).toMatch(/row-level security/);
  });

  it('A can still update its own rows normally', async () => {
    const { error } = await A.client.from('applications').update({ status: 'offer', resume_id: a.resume }).eq('id', a.application);
    expect(error).toBeNull();
  });
});

describe('analytics view and storage', () => {
  it('version_stats only shows the caller’s resumes', async () => {
    const { data } = await A.client.from('version_stats').select('resume_id, user_id');
    expect(data!.every((r: any) => r.user_id === A.id)).toBe(true);
    expect(data!.map((r: any) => r.resume_id)).toContain(a.resume);
    expect(await anon().from('version_stats').select('*').then((r) => r.data ?? [])).toEqual([]);
  });

  it('A cannot upload into or read from B’s storage folder', async () => {
    const path = `${B.id}/r.pdf`;
    const up = await A.client.storage.from('resume-files').upload(path, new Blob(['x']), { contentType: 'application/pdf' });
    expect(up.error).not.toBeNull();

    await B.client.storage.from('resume-files').upload(path, new Blob(['secret']), { contentType: 'application/pdf', upsert: true });
    const dl = await A.client.storage.from('resume-files').download(path);
    expect(dl.data).toBeNull();
    const own = await A.client.storage.from('resume-files').upload(`${A.id}/r.pdf`, new Blob(['mine']), { contentType: 'application/pdf', upsert: true });
    expect(own.error).toBeNull();
  });
});
