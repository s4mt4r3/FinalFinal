import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { checkRateLimit } from '@/lib/rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  const hit = (user: string, path: string, n: number) => {
    let last = { allowed: true } as ReturnType<typeof checkRateLimit>;
    for (let i = 0; i < n; i++) last = checkRateLimit(user, path);
    return last;
  };

  it('allows 60 default requests per minute and blocks the 61st with Retry-After', () => {
    const u = randomUUID();
    expect(hit(u, '/api/resumes', 60).allowed).toBe(true);
    const blocked = checkRateLimit(u, '/api/resumes');
    expect(blocked).toEqual({ allowed: false, retryAfter: 60 });
  });

  it('applies the stricter 20/min limit to export and match', () => {
    for (const path of ['/api/resumes/export', '/api/resumes/match']) {
      const u = randomUUID();
      expect(hit(u, path, 20).allowed).toBe(true);
      expect(checkRateLimit(u, path).allowed).toBe(false);
    }
  });

  it('keeps heavy and default buckets independent', () => {
    const u = randomUUID();
    hit(u, '/api/resumes/export', 20);
    expect(checkRateLimit(u, '/api/resumes/export').allowed).toBe(false);
    expect(checkRateLimit(u, '/api/sections').allowed).toBe(true);
  });

  it('isolates users from one another', () => {
    const a = randomUUID();
    const b = randomUUID();
    hit(a, '/api/resumes', 60);
    expect(checkRateLimit(a, '/api/resumes').allowed).toBe(false);
    expect(checkRateLimit(b, '/api/resumes').allowed).toBe(true);
  });

  it('slides the window: capacity returns as old hits age out', () => {
    const u = randomUUID();
    hit(u, '/api/resumes', 30);
    vi.advanceTimersByTime(30_000);
    hit(u, '/api/resumes', 30);
    expect(checkRateLimit(u, '/api/resumes')).toEqual({ allowed: false, retryAfter: 30 });
    vi.advanceTimersByTime(30_000);
    expect(checkRateLimit(u, '/api/resumes').allowed).toBe(true);
  });

  it('does not record blocked requests (a client hammering a 429 is not locked out longer)', () => {
    const u = randomUUID();
    hit(u, '/api/resumes', 60);
    hit(u, '/api/resumes', 100);
    vi.advanceTimersByTime(60_001);
    expect(checkRateLimit(u, '/api/resumes').allowed).toBe(true);
  });
});
