'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-client';

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;0,9..144,900;1,9..144,400;1,9..144,500&family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');

  :root {
    --paper: #F5F0E6;
    --paper-2: #EFE9DB;
    --paper-3: #E8E1D0;
    --ink: #1A1815;
    --ink-2: #3A3631;
    --ink-3: #6B6459;
    --line: #D9D0BC;
    --line-2: #C9BFA7;
    --accent: #B8451F;
    --accent-2: #9C3A18;
    --accent-soft: #F0D9CC;
  }
  .ff-app, .ff-app * {
    font-family: 'Fraunces', Georgia, serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .ff-mono, .ff-mono * { font-family: 'IBM Plex Mono', ui-monospace, monospace !important; }
  .ff-app {
    background: var(--paper);
    color: var(--ink);
    font-feature-settings: "ss01", "ss02";
  }
  .ff-display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; font-variation-settings: "opsz" 144, "SOFT" 50; letter-spacing: -0.02em; }
  .ff-italic { font-style: italic; font-variation-settings: "opsz" 144, "SOFT" 100; }
  .ff-label { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 500; }

  .ff-paper {
    background-color: var(--paper);
    background-image:
      radial-gradient(rgba(60,40,20,0.025) 1px, transparent 1px),
      radial-gradient(rgba(60,40,20,0.018) 1px, transparent 1px);
    background-size: 24px 24px, 47px 47px;
    background-position: 0 0, 12px 23px;
  }

  .ff-card-raised {
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 4px;
    box-shadow: 0 1px 0 rgba(60,40,20,0.04), 0 8px 24px -16px rgba(60,40,20,0.18);
  }

  .ff-btn {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 500;
    padding: 11px 20px;
    border-radius: 3px;
    border: 1px solid var(--ink);
    background: var(--ink);
    color: var(--paper);
    cursor: pointer;
    transition: all 120ms ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    white-space: nowrap;
  }
  .ff-btn:hover { background: var(--accent); border-color: var(--accent); }
  .ff-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .ff-btn:disabled:hover { background: var(--ink); border-color: var(--ink); }

  @keyframes ff-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  .ff-fade { animation: ff-fade 320ms ease-out both; }
`;

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M15.68 8.18c0-.57-.05-1.12-.14-1.64H8v3.1h4.3a3.67 3.67 0 0 1-1.59 2.41v2h2.57c1.5-1.38 2.4-3.42 2.4-5.87Z" fill="#4285F4"/>
    <path d="M8 16c2.16 0 3.97-.71 5.29-1.93l-2.57-2a4.8 4.8 0 0 1-7.17-2.52H.88v2.06A8 8 0 0 0 8 16Z" fill="#34A853"/>
    <path d="M3.55 9.55A4.8 4.8 0 0 1 3.3 8c0-.54.1-1.06.25-1.55V4.39H.88A8 8 0 0 0 0 8c0 1.29.31 2.51.88 3.61l2.67-2.06Z" fill="#FBBC05"/>
    <path d="M8 3.18c1.22 0 2.31.42 3.17 1.24l2.37-2.37A8 8 0 0 0 .88 4.39l2.67 2.06A4.77 4.77 0 0 1 8 3.18Z" fill="#EA4335"/>
  </svg>
);

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="ff-app ff-paper" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <style>{STYLES}</style>

      <div className="ff-card-raised ff-fade" style={{ width: '100%', maxWidth: 400, padding: '48px 44px' }}>
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <div className="ff-display" style={{ fontSize: 38, fontWeight: 600, lineHeight: 1, letterSpacing: '-0.03em' }}>
            Final<span style={{ color: 'var(--accent)' }} className="ff-italic">Final</span>
          </div>
          <div className="ff-mono ff-label" style={{ marginTop: 8, color: 'var(--ink-3)' }}>
            resume version control
          </div>
        </div>

        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div className="ff-display" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Sign in to continue.
          </div>
          <div style={{ marginTop: 10, fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            Track every version of your resume and see what gets callbacks.
          </div>
        </div>

        <button className="ff-btn" onClick={signInWithGoogle} disabled={loading}>
          {loading ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true">
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4" strokeDashoffset="10" />
              </svg>
              Redirecting…
            </>
          ) : (
            <>
              <GoogleIcon />
              Continue with Google
            </>
          )}
        </button>

        {error && (
          <div className="ff-mono" style={{ marginTop: 16, fontSize: 11, color: 'var(--accent)', textAlign: 'center', lineHeight: 1.5 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
