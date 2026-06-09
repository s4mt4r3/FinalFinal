const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;0,9..144,900;1,9..144,400;1,9..144,500&family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');

  :root {
    --paper: #F5F0E6;
    --paper-2: #EFE9DB;
    --ink: #1A1815;
    --ink-2: #3A3631;
    --ink-3: #6B6459;
    --line: #D9D0BC;
    --accent: #B8451F;
    --accent-soft: #F0D9CC;
  }
  .ff-app, .ff-app * { font-family: 'Fraunces', Georgia, serif; -webkit-font-smoothing: antialiased; }
  .ff-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace !important; }
  .ff-app { background: var(--paper); color: var(--ink); font-feature-settings: "ss01", "ss02"; }
  .ff-display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; font-variation-settings: "opsz" 144, "SOFT" 50; letter-spacing: -0.02em; }
  .ff-italic { font-style: italic; font-variation-settings: "opsz" 144, "SOFT" 100; }
  .ff-label { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 500; }
  .ff-paper {
    background-color: var(--paper);
    background-image: radial-gradient(rgba(60,40,20,0.025) 1px, transparent 1px), radial-gradient(rgba(60,40,20,0.018) 1px, transparent 1px);
    background-size: 24px 24px, 47px 47px;
    background-position: 0 0, 12px 23px;
  }
  .privacy-body { max-width: 680px; margin: 0 auto; padding: 64px 24px 96px; }
  .privacy-body h2 { font-size: 13px; font-family: 'IBM Plex Mono', monospace; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 500; color: var(--ink-3); margin: 40px 0 10px; }
  .privacy-body p, .privacy-body li { font-size: 15px; line-height: 1.75; color: var(--ink-2); }
  .privacy-body ul { padding-left: 20px; margin: 8px 0; }
  .privacy-body li { margin-bottom: 4px; }
  .privacy-body a { color: var(--accent); text-decoration: none; }
  .privacy-body a:hover { text-decoration: underline; }
  .privacy-divider { border: none; border-top: 1px solid var(--line); margin: 40px 0; }
`;

export default function PrivacyPage() {
  return (
    <div className="ff-app ff-paper" style={{ minHeight: '100vh' }}>
      <style>{STYLES}</style>
      <div className="privacy-body">
        <a href="/login" className="ff-mono ff-label" style={{ color: 'var(--ink-3)', fontSize: 10.5, display: 'inline-block', marginBottom: 40 }}>
          ← Back to FinalFinal
        </a>

        <div style={{ marginBottom: 48 }}>
          <div className="ff-display" style={{ fontSize: 42, fontWeight: 600, lineHeight: 1, letterSpacing: '-0.03em' }}>
            Final<span style={{ color: 'var(--accent)' }} className="ff-italic">Final</span>
          </div>
          <div className="ff-mono ff-label" style={{ marginTop: 8, color: 'var(--ink-3)' }}>Privacy Policy</div>
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--ink-3)', fontFamily: 'IBM Plex Mono, monospace' }}>
            Last updated: June 9, 2026
          </p>
        </div>

        <p>
          FinalFinal is a free, personal resume composer. This policy explains what data we collect,
          how it is used, and your rights over it. We do not sell your data, run ads, or share your
          information with third parties for marketing purposes.
        </p>

        <hr className="privacy-divider" />

        <h2>Who we are</h2>
        <p>
          FinalFinal is a personal project operated by an individual developer. Questions about this
          policy can be sent to <a href="mailto:app.finalfinal@gmail.com">app.finalfinal@gmail.com</a>.
        </p>

        <h2>What data we collect</h2>
        <p>When you sign in and use FinalFinal, we collect:</p>
        <ul>
          <li><strong>Account information</strong> — your name, email address, and profile photo provided by Google when you sign in via Google OAuth.</li>
          <li><strong>Resume content</strong> — section variants (header, education, experience, projects, skills, etc.) and composed resumes that you create inside the app.</li>
          <li><strong>Application and interview data</strong> — job applications and interview records you log, including company names, roles, dates, and notes.</li>
          <li><strong>Usage analytics</strong> — callback and response rates derived from your own application data (no third-party tracking scripts).</li>
        </ul>

        <h2>How we use your data</h2>
        <ul>
          <li>To authenticate you and associate your content with your account.</li>
          <li>To store and retrieve your resume sections, compositions, applications, and interview records.</li>
          <li>To compute keyword matching and analytics displayed to you within the app.</li>
        </ul>
        <p>We do not use your data to train AI models, profile you for advertising, or share it with any third parties beyond the infrastructure providers listed below.</p>

        <h2>Third-party services</h2>
        <p>FinalFinal relies on the following infrastructure providers. Each has its own privacy policy:</p>
        <ul>
          <li><strong>Supabase</strong> — database and authentication. Your data is stored in Supabase's hosted Postgres. <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">supabase.com/privacy</a></li>
          <li><strong>Google OAuth</strong> — sign-in only. We receive your name, email, and profile photo; we do not access your Google Drive, Gmail, or any other Google service. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">policies.google.com/privacy</a></li>
          <li><strong>Vercel</strong> — hosting and deployment. Request logs may be retained per Vercel's standard policy. <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">vercel.com/legal/privacy-policy</a></li>
        </ul>

        <h2>Data storage and security</h2>
        <p>
          All data is stored in Supabase with row-level security enforced — each user can only read
          and write their own records. Connections are encrypted in transit (TLS). We do not store
          passwords; authentication is handled entirely by Google OAuth via Supabase Auth.
        </p>

        <h2>Data retention</h2>
        <p>
          Your data is retained for as long as your account exists. If you would like your account
          and all associated data deleted, email <a href="mailto:app.finalfinal@gmail.com">app.finalfinal@gmail.com</a> and
          we will remove it within 30 days.
        </p>

        <h2>Your rights</h2>
        <p>Regardless of where you are located, you have the right to:</p>
        <ul>
          <li>Request a copy of the data we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion of your account and all associated data.</li>
        </ul>
        <p>To exercise any of these rights, email <a href="mailto:app.finalfinal@gmail.com">app.finalfinal@gmail.com</a>.</p>

        <h2>Children</h2>
        <p>
          FinalFinal is not directed at children under 13. We do not knowingly collect data from
          anyone under 13.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          If we make material changes to this policy, we will update the "last updated" date above.
          Continued use of the app after changes constitutes acceptance of the revised policy.
        </p>

        <hr className="privacy-divider" />
        <p style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'IBM Plex Mono, monospace' }}>
          Questions? <a href="mailto:app.finalfinal@gmail.com">app.finalfinal@gmail.com</a>
        </p>
      </div>
    </div>
  );
}
