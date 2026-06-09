// Simple in-memory sliding-window rate limiter.
// Keyed by user ID — resets on cold start, but that's fine for a personal project.
// Upgrade to Upstash Redis if you ever need cross-instance enforcement.

const windows = new Map<string, number[]>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 60;  // per user per window

// Stricter limit for expensive routes (keyword matching, export)
const MAX_REQUESTS_HEAVY = 20;
const HEAVY_ROUTES = ['/api/resumes/match', '/api/resumes/export'];

export function checkRateLimit(userId: string, pathname: string): { allowed: boolean; retryAfter?: number } {
  const isHeavy = HEAVY_ROUTES.some((r) => pathname.startsWith(r));
  const limit = isHeavy ? MAX_REQUESTS_HEAVY : MAX_REQUESTS;
  const key = `${userId}:${isHeavy ? 'heavy' : 'default'}`;
  const now = Date.now();

  const hits = (windows.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= limit) {
    const oldest = hits[0];
    const retryAfter = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }

  hits.push(now);
  windows.set(key, hits);
  return { allowed: true };
}
