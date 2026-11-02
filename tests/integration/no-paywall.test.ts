import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ENDPOINTS, happyResponder } from './endpoints';
import { callRoute, newUser } from '../helpers/route';
import { createSupabaseMock } from '../helpers/supabase-mock';
import { signInAs } from '../helpers/mock-supabase-server';

vi.mock('@/lib/supabase-server', () => import('../helpers/mock-supabase-server'));

const ROOT = path.resolve(__dirname, '../..');
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = path.join(dir, d.name);
    if (d.isDirectory()) return sourceFiles(rel);
    return /\.(ts|tsx)$/.test(d.name) ? [rel] : [];
  });
}

// FinalFinal is free: no billing, paywalls or tier gates. These patterns are what
// a gate would have to look like; any hit fails the build.
const GATE_PATTERNS: [RegExp, string][] = [
  [/from\(\s*['"]subscriptions['"]/, 'reads/writes the orphaned subscriptions table'],
  [/requirePlus|isPlus|hasPlus|requirePro|requireSubscription/i, 'tier-gate helper'],
  [/status:\s*402\b/, 'HTTP 402 Payment Required'],
  [/from\s+['"](@stripe\/|stripe['"])|require\(['"]stripe|STRIPE_[A-Z_]+|\bstripe\.(checkout|subscriptions|customers|billingPortal)/, 'Stripe integration'],
  [/\btier\s*[!=]==?\s*['"](plus|pro|premium|paid)/i, 'tier comparison'],
  [/upgrade to (plus|pro|premium)/i, 'upgrade prompt'],
];

describe('no billing, paywalls or tier gates', () => {
  const files = [...sourceFiles('app'), ...sourceFiles('lib'), ...sourceFiles('components'), 'middleware.ts'];

  it('scans a meaningful amount of source', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it.each(GATE_PATTERNS)('no source file matches %s', (re, what) => {
    const hits = files.filter((f) => re.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
    expect(hits, `${what} found in: ${hits.join(', ')}`).toEqual([]);
  });

  it('serves every feature to a brand-new user with no subscription row', async () => {
    for (const e of ENDPOINTS) {
      const m = createSupabaseMock(happyResponder);
      signInAs(newUser(), m.client);
      const mod = await e.load();
      const res = await callRoute(mod[e.method], { method: e.method, url: e.url, params: e.params, body: e.body });
      expect(res.status, e.name).toBe(e.okStatus);
      expect(m.callsTo('subscriptions'), e.name).toEqual([]);
    }
  });

  it('applies the same rate limits to every user (keyed by id only, no tier input)', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    expect(checkRateLimit.length).toBe(2);
  });
});
