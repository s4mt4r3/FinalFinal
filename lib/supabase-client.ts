// ============================================================
// lib/supabase/client.ts
// ============================================================
// Browser-side Supabase client. Use this from React components
// marked "use client" (e.g. login button, dropzone upload).
//
// For data reads/writes, prefer calling your /api routes — they
// run on the server and have stricter validation. Use this
// client mainly for auth (signIn, signOut) and Storage uploads.
// ============================================================

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
