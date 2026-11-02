import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';

type RouteHandler = (
  req: Request,
  ctx: { params: Promise<Record<string, string>> } | undefined
) => Promise<Response> | Response;

export interface RouteResponse {
  status: number;
  headers: Headers;
  json: any;
  text: string;
}

export async function callRoute(
  handler: RouteHandler,
  opts: {
    method?: string;
    url: string;
    body?: unknown;
    params?: Record<string, string>;
    headers?: Record<string, string>;
  }
): Promise<RouteResponse> {
  const body =
    opts.body === undefined ? undefined : typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  const req = new Request(`http://localhost:3000${opts.url}`, {
    method: opts.method ?? 'GET',
    body,
    headers: { 'content-type': 'application/json', ...opts.headers },
  });
  const res = await handler(req, opts.params ? { params: Promise.resolve(opts.params) } : undefined);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-JSON body (export routes)
  }
  return { status: res.status, headers: res.headers, json, text };
}

export const newUser = (email = 'user@example.com') => ({ id: randomUUID(), email });

// Fires `n` requests through the handler for the same user to trip the limiter.
export async function exhaustRateLimit(handler: RouteHandler, url: string, n: number, init: Parameters<typeof callRoute>[1] = { url }) {
  for (let i = 0; i < n; i++) await callRoute(handler, { ...init, url });
}

export function silenceConsoleError() {
  return vi.spyOn(console, 'error').mockImplementation(() => {});
}
