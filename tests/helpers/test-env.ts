import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');

// Loads `.env.test` (never `.env.local`, which points at production) and refuses
// to continue unless the Supabase URL is a local stack. A separate hosted test
// project can be used by setting TEST_SUPABASE_ALLOW_REMOTE=1 explicitly.
export function loadTestEnv(): {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  dbUrl: string;
} {
  const file = path.join(ROOT, '.env.test');
  if (fs.existsSync(file)) process.loadEnvFile(file);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const dbUrl = process.env.SUPABASE_DB_URL ?? '';

  const missing = Object.entries({
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    SUPABASE_DB_URL: dbUrl,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(
      `Missing ${missing.join(', ')}. Copy .env.test.example to .env.test and run \`npx supabase start\`.`
    );
  }

  assertSafeSupabaseUrl(url);
  return { url, anonKey, serviceRoleKey, dbUrl };
}

export function assertSafeSupabaseUrl(url: string) {
  const host = new URL(url).hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (!isLocal && process.env.TEST_SUPABASE_ALLOW_REMOTE !== '1') {
    throw new Error(
      `Refusing to run tests against non-local Supabase (${host}). ` +
        'Use `npx supabase start`, or set TEST_SUPABASE_ALLOW_REMOTE=1 for a dedicated test project.'
    );
  }
}
