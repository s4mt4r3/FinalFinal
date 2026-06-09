const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;0,9..144,900;1,9..144,400;1,9..144,500&family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');

  :root {
    --paper: #F5F0E6; --paper-2: #EFE9DB; --ink: #1A1815;
    --ink-2: #3A3631; --ink-3: #6B6459; --line: #D9D0BC; --accent: #B8451F;
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
    background-size: 24px 24px, 47px 47px; background-position: 0 0, 12px 23px;
  }
  .tos-body { max-width: 680px; margin: 0 auto; padding: 64px 24px 96px; }
  .tos-body h2 { font-size: 13px; font-family: 'IBM Plex Mono', monospace; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 500; color: var(--ink-3); margin: 40px 0 10px; }
  .tos-body p, .tos-body li { font-size: 15px; line-height: 1.75; color: var(--ink-2); }
  .tos-body ul { padding-left: 20px; margin: 8px 0; }
  .tos-body li { margin-bottom: 4px; }
  .tos-body a { color: var(--accent); text-decoration: none; }
  .tos-body a:hover { text-decoration: underline; }
  .tos-divider { border: none; border-top: 1px solid var(--line); margin: 40px 0; }
`;

export default function TosPage() {
  return (
    <div className="ff-app ff-paper" style={{ minHeight: '100vh' }}>
      <style>{STYLES}</style>
      <div className="tos-body">
        <a href="/login" className="ff-mono ff-label" style={{ color: 'var(--ink-3)', fontSize: 10.5, display: 'inline-block', marginBottom: 40 }}>
          ← Back to FinalFinal
        </a>

        <div style={{ marginBottom: 48 }}>
          <div className="ff-display" style={{ fontSize: 42, fontWeight: 600, lineHeight: 1, letterSpacing: '-0.03em' }}>
            Final<span style={{ color: 'var(--accent)' }} className="ff-italic">Final</span>
          </div>
          <div className="ff-mono ff-label" style={{ marginTop: 8, color: 'var(--ink-3)' }}>Terms of Service</div>
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--ink-3)', fontFamily: 'IBM Plex Mono, monospace' }}>
            Last updated: June 9, 2026
          </p>
        </div>

        <p>
          By using FinalFinal you agree to these terms. FinalFinal is a free personal project — please
          use it responsibly.
        </p>

        <hr className="tos-divider" />

        <h2>Who operates this service</h2>
        <p>
          FinalFinal is a personal project operated by an individual developer. Questions can be sent
          to <a href="mailto:samiktare@gmail.com">samiktare@gmail.com</a>.
        </p>

        <h2>Eligibility</h2>
        <p>
          You must be at least 13 years old to use FinalFinal. By signing in you confirm that you meet
          this requirement.
        </p>

        <h2>Acceptable use</h2>
        <p>You may use FinalFinal to build, store, and export your own resumes. You agree not to:</p>
        <ul>
          <li>Attempt to access other users' data.</li>
          <li>Scrape, crawl, or automate requests to the service.</li>
          <li>Attempt to reverse-engineer, overload, or otherwise disrupt the service.</li>
          <li>Use the service to store content that is illegal or infringes third-party rights.</li>
          <li>Create accounts for purposes other than personal resume management.</li>
        </ul>

        <h2>Your content</h2>
        <p>
          You own the resume content you create. You grant FinalFinal a limited licence to store and
          process it solely to provide the service to you. We do not share, sell, or use your content
          for any other purpose.
        </p>

        <h2>No warranty</h2>
        <p>
          FinalFinal is provided <strong>"as is"</strong> without warranty of any kind, express or
          implied. We do not guarantee uptime, data durability, or fitness for any particular purpose.
          Use it at your own risk.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, the operator of FinalFinal shall not be liable for
          any indirect, incidental, or consequential damages arising from your use of the service,
          including loss of data. Our total liability to you for any claim shall not exceed zero
          dollars, as the service is provided free of charge.
        </p>

        <h2>Account termination</h2>
        <p>
          We reserve the right to suspend or terminate accounts that violate these terms, at our sole
          discretion and without prior notice. You may request deletion of your account at any time by
          emailing <a href="mailto:samiktare@gmail.com">samiktare@gmail.com</a>.
        </p>

        <h2>Changes to these terms</h2>
        <p>
          We may update these terms at any time. The "last updated" date above will reflect changes.
          Continued use of the service after changes constitutes acceptance of the revised terms.
        </p>

        <h2>Governing law</h2>
        <p>
          These terms are governed by the laws of the State of New York, United States, without regard
          to conflict of law principles.
        </p>

        <hr className="tos-divider" />
        <p style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'IBM Plex Mono, monospace' }}>
          Questions? <a href="mailto:samiktare@gmail.com">samiktare@gmail.com</a>
        </p>
      </div>
    </div>
  );
}
