// ============================================================
// app/api/auth/signout/route.ts
// ============================================================
//   POST /api/auth/signout   → clears the auth cookie
// ============================================================

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.json({ success: true });
}
