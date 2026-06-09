// ============================================================
// middleware.ts  (lives at project root, not in /app)
// ============================================================
// Runs on every request before the route is handled. Its jobs:
//   1. Refresh the Supabase auth session cookie if expired.
//   2. Forward the current pathname as x-pathname so that
//      app/layout.tsx can read it for auth-gating.
//      (Server Components cannot access pathname directly —
//      this header is the documented Next.js workaround.)
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Everything below is best-effort session refresh. Any failure here
  // (bad env vars, Supabase network blip, cookie issues) must not turn
  // into a 500 — the root layout does its own auth check and redirect,
  // so middleware can always safely fall through.
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      });

      // Touching getUser() refreshes the session cookie if needed.
      await supabase.auth.getUser();
    }
  } catch {
    // Session refresh failed — continue the request anyway.
    response = NextResponse.next({ request });
  }

  // Forward the pathname so the root layout can gate on it.
  response.headers.set('x-pathname', request.nextUrl.pathname);

  return response;
}

// Run on every route except static assets and image optimization.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
