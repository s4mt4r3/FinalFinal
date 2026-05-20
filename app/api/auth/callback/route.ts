// ============================================================
// app/api/auth/callback/route.ts
// ============================================================
// OAuth redirect handler. When a user signs in with Google,
// Supabase redirects them back to:
//   https://yourapp.com/api/auth/callback?code=<token>
//
// This route exchanges the code for a session cookie, then sends
// the user to the dashboard. Without this, the OAuth handshake
// never completes.
// ============================================================

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
