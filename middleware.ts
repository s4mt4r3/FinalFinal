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

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  );

  // Touching getUser() refreshes the session cookie if needed.
  // Wrapped in try/catch so a Supabase timeout or network blip doesn't
  // crash the middleware and return 500 — the layout handles auth gating.
  try {
    await supabase.auth.getUser();
  } catch {
    // Session refresh failed — continue the request anyway.
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
