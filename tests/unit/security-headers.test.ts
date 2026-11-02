import { describe, expect, it, vi } from 'vitest';

async function loadHeaders(supabaseUrl?: string) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl as string);
  const config = (await import('@/next.config')).default;
  const rules = await config.headers!();
  return { config, rules };
}

const directives = (csp: string) =>
  Object.fromEntries(
    csp.split(';').map((d) => {
      const [name, ...values] = d.trim().split(/\s+/);
      return [name, values];
    })
  );

describe('next.config security headers', () => {
  it('applies the security headers to every route', async () => {
    const { rules } = await loadHeaders('https://abc123.supabase.co');
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe('/(.*)');
    const h = Object.fromEntries(rules[0].headers.map((x) => [x.key, x.value]));
    expect(h['X-Frame-Options']).toBe('DENY');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(h['Content-Security-Policy']).toBeTruthy();
  });

  it('builds a CSP locked to self plus the configured Supabase host', async () => {
    const { rules } = await loadHeaders('https://abc123.supabase.co');
    const csp = rules[0].headers.find((x) => x.key === 'Content-Security-Policy')!.value;
    const d = directives(csp);
    expect(d['default-src']).toEqual(["'self'"]);
    expect(d['connect-src']).toEqual(["'self'", 'https://abc123.supabase.co', 'wss://abc123.supabase.co']);
    expect(d['frame-ancestors']).toEqual(["'none'"]);
    expect(d['object-src']).toEqual(["'none'"]);
    expect(d['base-uri']).toEqual(["'self'"]);
    expect(d['frame-src']).toEqual(["'none'"]);
    expect(d['script-src']).not.toContain("'unsafe-eval'");
    expect(d['img-src']).toEqual(["'self'", 'data:', 'blob:', 'https://lh3.googleusercontent.com']);
    expect(csp).not.toMatch(/\*(?!\.supabase\.co)/);
  });

  it('falls back to the *.supabase.co wildcard when the URL is unset', async () => {
    const { rules } = await loadHeaders(undefined);
    const csp = rules[0].headers.find((x) => x.key === 'Content-Security-Policy')!.value;
    expect(directives(csp)['connect-src']).toEqual(["'self'", 'https://*.supabase.co', 'wss://*.supabase.co']);
  });

  it('keeps ignoreBuildErrors so known Supabase typing quirks never block a deploy', async () => {
    const { config } = await loadHeaders('https://abc123.supabase.co');
    expect(config.typescript?.ignoreBuildErrors).toBe(true);
  });
});
