// ============================================================
// lib/demo-mode.ts
// ============================================================
// The on/off switch for demo mode (browse the app without
// signing in). Backed by sessionStorage so it survives client
// navigation within a tab but never a fresh session, and is
// safe to import from both client components and lib/api.ts.
// ============================================================

const KEY = 'ff_demo_mode';

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function enableDemoMode() {
  try {
    window.sessionStorage.setItem(KEY, '1');
  } catch {
    // sessionStorage unavailable — demo mode just won't persist across nav.
  }
}

export function disableDemoMode() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
