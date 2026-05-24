// ============================================================
// lib/pdf-templates.ts
// ============================================================
// Parses plain-text resume content into sections, then renders
// it as a complete HTML document with embedded CSS. The client
// passes that HTML to html2pdf.js to produce the final PDF.
// ============================================================

export type TemplateId = 'jake' | 'compact' | 'modern' | 'tech';

export const TEMPLATES: { id: TemplateId; label: string; blurb: string }[] = [
  { id: 'jake',    label: "Jake's",  blurb: 'ATS-optimized, single column. The classic.' },
  { id: 'compact', label: 'Compact', blurb: 'Tight one-page layout. Smaller margins.' },
  { id: 'modern',  label: 'Modern',  blurb: 'Two-column. Skills sidebar, content on the right.' },
  { id: 'tech',    label: 'Tech',    blurb: 'Projects-first ordering. Monospace accents.' },
];

interface Entry {
  title: string;
  body: string[];
}

interface Section {
  title: string;
  entries: Entry[];
}

export interface ParsedResume {
  name: string;
  contact: string;
  sections: Section[];
}

function isSectionHeader(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 40) return false;
  // ALL CAPS plus a few legal punctuation chars; must contain at least one letter
  if (!/[A-Z]/.test(t)) return false;
  return /^[A-Z][A-Z0-9 &/.\-]*$/.test(t);
}

export function parseResume(text: string): ParsedResume {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;

  const name = (lines[i] ?? '').trim();
  i++;
  while (i < lines.length && lines[i].trim() === '') i++;

  let contact = '';
  if (i < lines.length && !isSectionHeader(lines[i])) {
    contact = lines[i].trim();
    i++;
  }

  const sections: Section[] = [];
  let section: Section | null = null;
  let entry: Entry | null = null;

  const flushEntry = () => {
    if (entry && section) section.entries.push(entry);
    entry = null;
  };
  const flushSection = () => {
    flushEntry();
    if (section) sections.push(section);
    section = null;
  };

  for (; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (isSectionHeader(raw)) {
      flushSection();
      section = { title: t, entries: [] };
      continue;
    }
    if (!t) {
      flushEntry();
      continue;
    }
    if (!section) continue;
    if (!entry) entry = { title: t, body: [] };
    else entry.body.push(t);
  }
  flushSection();

  return { name, contact, sections };
}

// ------------------------------------------------------------
// Escape user-supplied strings before inlining into HTML.
// ------------------------------------------------------------
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function reorderForTech(sections: Section[]): Section[] {
  const want = ['EDUCATION', 'PROJECTS', 'SKILLS', 'EXPERIENCE'];
  const score = (title: string) => {
    const idx = want.indexOf(title.toUpperCase());
    return idx === -1 ? want.length + 1 : idx;
  };
  return [...sections].sort((a, b) => score(a.title) - score(b.title));
}

// ------------------------------------------------------------
// Templates
// ------------------------------------------------------------
const SHARED_RESET = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  ul { margin: 4px 0 0 18px; padding: 0; }
  li { margin: 2px 0; }
`;

function renderJake(r: ParsedResume): string {
  const sections = r.sections.map((s) => `
    <section class="sec">
      <h2>${esc(s.title)}</h2>
      ${s.entries.map((e) => `
        <div class="entry">
          <div class="title">${esc(e.title)}</div>
          ${e.body.length ? `<ul>${e.body.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
        </div>
      `).join('')}
    </section>
  `).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${SHARED_RESET}
    body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.32; padding: 0.5in 0.6in; }
    header { text-align: center; margin-bottom: 10px; }
    header .name { font-size: 22pt; font-weight: 700; letter-spacing: 0.5px; }
    header .contact { font-size: 10pt; margin-top: 3px; color: #222; }
    .sec { margin-top: 12px; }
    .sec h2 {
      font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
      margin: 0 0 4px 0; padding-bottom: 2px; border-bottom: 1px solid #111;
    }
    .entry { margin-top: 6px; }
    .entry .title { font-weight: 700; font-size: 11pt; }
    .entry ul { list-style: disc; }
    .entry li { font-size: 10.5pt; }
  </style></head><body>
    <header>
      <div class="name">${esc(r.name)}</div>
      ${r.contact ? `<div class="contact">${esc(r.contact)}</div>` : ''}
    </header>
    ${sections}
  </body></html>`;
}

function renderCompact(r: ParsedResume): string {
  const sections = r.sections.map((s) => `
    <section class="sec">
      <h2>${esc(s.title)}</h2>
      ${s.entries.map((e) => `
        <div class="entry">
          <div class="title">${esc(e.title)}</div>
          ${e.body.map((b) => `<div class="body">${esc(b)}</div>`).join('')}
        </div>
      `).join('')}
    </section>
  `).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${SHARED_RESET}
    body { font-family: Georgia, 'Times New Roman', serif; font-size: 10pt; line-height: 1.28; padding: 0.4in 0.5in; }
    header { margin-bottom: 6px; border-bottom: 2px solid #111; padding-bottom: 4px; }
    header .name { font-size: 18pt; font-weight: 700; letter-spacing: 0.3px; }
    header .contact { font-size: 9pt; color: #333; margin-top: 1px; }
    .sec { margin-top: 8px; }
    .sec h2 {
      font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;
      margin: 0 0 3px 0; color: #111;
    }
    .entry { margin-top: 3px; }
    .entry .title { font-weight: 700; font-size: 10pt; }
    .entry .body { font-size: 9.5pt; padding-left: 10px; color: #222; }
  </style></head><body>
    <header>
      <div class="name">${esc(r.name)}</div>
      ${r.contact ? `<div class="contact">${esc(r.contact)}</div>` : ''}
    </header>
    ${sections}
  </body></html>`;
}

function renderModern(r: ParsedResume): string {
  const sidebarTitles = new Set(['SKILLS', 'TECHNICAL SKILLS', 'CONTACT', 'LANGUAGES']);
  const sidebar = r.sections.filter((s) => sidebarTitles.has(s.title.toUpperCase()));
  const main = r.sections.filter((s) => !sidebarTitles.has(s.title.toUpperCase()));

  const renderEntries = (s: Section, dense = false) => s.entries.map((e) => `
    <div class="entry">
      <div class="title">${esc(e.title)}</div>
      ${e.body.length
        ? (dense
            ? `<div class="body">${e.body.map((b) => esc(b)).join(', ')}</div>`
            : `<ul>${e.body.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`)
        : ''}
    </div>
  `).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${SHARED_RESET}
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10.5pt; line-height: 1.4; padding: 0.45in 0.5in; }
    .grid { display: flex; gap: 22px; }
    aside { width: 33%; }
    main { flex: 1; min-width: 0; }
    .name { font-size: 22pt; font-weight: 700; letter-spacing: 0.4px; line-height: 1.05; }
    .contact { font-size: 9.5pt; margin-top: 6px; color: #333; }
    .sec { margin-top: 14px; }
    .sec h2 {
      font-size: 9.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;
      margin: 0 0 6px 0; color: #B8451F;
    }
    aside .sec { margin-top: 16px; }
    aside .body { font-size: 10pt; color: #222; }
    aside .title { font-weight: 600; font-size: 10pt; }
    main .entry { margin-top: 7px; }
    main .entry .title { font-weight: 700; font-size: 11pt; }
    main ul { list-style: disc; }
    main li { font-size: 10pt; }
  </style></head><body>
    <div class="grid">
      <aside>
        <div class="name">${esc(r.name)}</div>
        ${r.contact ? `<div class="contact">${esc(r.contact).split(/\s*\|\s*/).join('<br>')}</div>` : ''}
        ${sidebar.map((s) => `<section class="sec"><h2>${esc(s.title)}</h2>${renderEntries(s, true)}</section>`).join('')}
      </aside>
      <main>
        ${main.map((s) => `<section class="sec"><h2>${esc(s.title)}</h2>${renderEntries(s)}</section>`).join('')}
      </main>
    </div>
  </body></html>`;
}

function renderTech(r: ParsedResume): string {
  const ordered = reorderForTech(r.sections);
  const sections = ordered.map((s) => `
    <section class="sec">
      <h2>// ${esc(s.title.toLowerCase())}</h2>
      ${s.entries.map((e) => `
        <div class="entry">
          <div class="title">${esc(e.title)}</div>
          ${e.body.length ? `<ul>${e.body.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
        </div>
      `).join('')}
    </section>
  `).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${SHARED_RESET}
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      font-size: 10.5pt; line-height: 1.36; padding: 0.5in 0.55in;
    }
    .mono { font-family: 'SFMono-Regular', 'Menlo', Consolas, monospace; }
    header { display: flex; align-items: baseline; gap: 14px; border-bottom: 2px solid #111; padding-bottom: 6px; }
    header .name { font-size: 20pt; font-weight: 700; letter-spacing: 0.3px; }
    header .contact {
      font-family: 'SFMono-Regular', Menlo, Consolas, monospace;
      font-size: 8.5pt; color: #444; margin-left: auto; text-align: right;
    }
    .sec { margin-top: 12px; }
    .sec h2 {
      font-family: 'SFMono-Regular', Menlo, Consolas, monospace;
      font-size: 10pt; font-weight: 600; letter-spacing: 0.5px;
      margin: 0 0 5px 0; color: #2B5573;
    }
    .entry { margin-top: 6px; }
    .entry .title { font-weight: 700; font-size: 11pt; }
    .entry ul { list-style: square; }
    .entry li { font-size: 10pt; }
  </style></head><body>
    <header>
      <div class="name">${esc(r.name)}</div>
      ${r.contact ? `<div class="contact">${esc(r.contact)}</div>` : ''}
    </header>
    ${sections}
  </body></html>`;
}

export function renderTemplate(text: string, template: TemplateId): string {
  const parsed = parseResume(text);
  switch (template) {
    case 'jake':    return renderJake(parsed);
    case 'compact': return renderCompact(parsed);
    case 'modern':  return renderModern(parsed);
    case 'tech':    return renderTech(parsed);
  }
}
