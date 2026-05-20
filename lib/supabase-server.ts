// ============================================================
// lib/supabase/server.ts
// ============================================================
// Server-side Supabase client for use inside API routes and
// Server Components. It reads the user's auth session from
// the request cookies, so every query is automatically scoped
// to the logged-in user (via RLS).
//
// The companion `client.ts` file is for browser components.
// ============================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

/**
 * Create a Supabase client for use in:
 *   - Route handlers (app/api/.../route.ts)
 *   - Server Components
 *   - Server Actions
 *
 * Reads/writes the session cookie so auth.uid() works in RLS.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — cookies are read-only.
            // The middleware will refresh the session instead.
          }
        },
      },
    }
  );
}

/**
 * Get the current user, or throw a 401-style error.
 * Use this at the top of every protected API route.
 */
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError('Not authenticated');
  }
  return { user, supabase };
}

export class AuthError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
