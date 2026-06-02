// ============================================================
// lib/pdf-templates.ts
// ============================================================
// Parses plain-text resume content into a structured model,
// then renders it as a complete HTML document with embedded
// CSS. The client passes that HTML to html2pdf.js to produce
// the final PDF.
//
// The parser is deliberately tolerant: it tries to recover
// the Jake-style structure (two-column entry headers with
// dates on the right, two-line subheadings with subtitle +
// location, pipe-separated project tech stacks, categorised
// skills, multi-column coursework) but falls back to plain
// rendering when the input doesn't carry that structure.
// ============================================================

export type TemplateId = 'jake' | 'compact' | 'modern' | 'tech';

export const TEMPLATES: { id: TemplateId; label: string; blurb: string }[] = [
  { id: 'jake',    label: "Jake's",  blurb: 'ATS-optimized, single column. The classic.' },
  { id: 'compact', label: 'Compact', blurb: 'Tight one-page layout. Smaller margins.' },
  { id: 'modern',  label: 'Modern',  blurb: 'Two-column. Skills sidebar, content on the right.' },
  { id: 'tech',    label: 'Tech',    blurb: 'Projects-first ordering. Monospace accents.' },
];

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------
export interface Entry {
  title: string;
  date?: string;
  subtitle?: string;
  location?: string;
  techStack?: string;
  bullets: string[];
}

export interface SkillCategory {
  category: string;
  items: string;
}

export type SectionKind = 'subheading' | 'project' | 'skills' | 'coursework';

export interface Section {
  title: string;
  kind: SectionKind;
  entries: Entry[];
  skills: SkillCategory[];
  coursework: string[];
}

export interface ParsedResume {
  name: string;
  contactLines: string[];
  sections: Section[];
}

// ------------------------------------------------------------
// Detection helpers
// ------------------------------------------------------------
const MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const SEASON = '(?:Spring|Summer|Fall|Autumn|Winter)';
const YEAR = '(?:19|20)\\d{2}';
const MONTH_YEAR = `${MONTH}\\.?\\s+${YEAR}`;
const DATE_TOKEN = `(?:${MONTH_YEAR}|${SEASON}\\s+${YEAR}|\\d{1,2}/${YEAR}|${YEAR})`;
const ENDPOINT = `(?:${DATE_TOKEN}|Present|Current|Now|Today|Ongoing)`;
const RANGE_SEP = '\\s*(?:--+|\\u2013|\\u2014|-|to|through)\\s*';
const DATE_PATTERN = `(?:${DATE_TOKEN}${RANGE_SEP}${ENDPOINT}|${ENDPOINT})`;
const TRAILING_DATE_RE = new RegExp(`^(.*?)(?:\\s{2,}|\\s+\\|\\s+|\\s+)(${DATE_PATTERN})\\s*$`, 'i');

const BULLET_RE = /^\s*[•●◦‣⁃∙·*\-–—]\s+/;

const SECTION_HEADER_RE = /^[A-Z][A-Z0-9 &/.\-]{1,38}[A-Z0-9.)]?$/;

function isSectionHeader(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 40) return false;
  if (!/[A-Z]/.test(t)) return false;
  // Require at least 2 letters and disallow ending with punctuation that suggests prose.
  if (/[.!?,:;]$/.test(t)) return false;
  return SECTION_HEADER_RE.test(t);
}

function isBullet(line: string): boolean {
  return BULLET_RE.test(line);
}

function stripBullet(line: string): string {
  return line.replace(BULLET_RE, '').trim();
}

// Split a line into (left, right) using the trailing date if present,
// otherwise using a >=2-space gap. Returns { left, right? }.
function splitTitleAndRight(line: string): { left: string; right?: string } {
  const t = line.trim().replace(/\s+$/, '');
  // First try: trailing date.
  const m = t.match(TRAILING_DATE_RE);
  if (m && m[1] && m[2]) {
    return { left: m[1].trim().replace(/[\s\-–—|]+$/, ''), right: m[2].trim() };
  }
  // Fallback: any 2+ space gap.
  const parts = t.split(/\s{2,}/);
  if (parts.length >= 2) {
    const right = parts[parts.length - 1].trim();
    const left = parts.slice(0, -1).join('  ').trim();
    if (left && right) return { left, right };
  }
  return { left: t };
}

function parseSkillLine(line: string): SkillCategory | null {
  const m = line.match(/^([A-Z][A-Za-z0-9 +/&.\-]{1,40}?)\s*[:\-]\s+(.+)$/);
  if (m) return { category: m[1].trim(), items: m[2].trim() };
  return null;
}

function sectionKind(title: string): SectionKind {
  const t = title.toUpperCase().trim();
  if (/(^|\s)(TECHNICAL\s+SKILLS|SKILLS|PROGRAMMING\s+SKILLS|CORE\s+COMPETENC|TOOLS)$/.test(t)) return 'skills';
  if (/COURSEWORK|COURSES|CLASSES/.test(t)) return 'coursework';
  if (/(^|\s)(PROJECTS?|PERSONAL\s+PROJECTS|SIDE\s+PROJECTS)$/.test(t)) return 'project';
  return 'subheading';
}

// ------------------------------------------------------------
// Parser
// ------------------------------------------------------------
export function parseResume(text: string): ParsedResume {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;

  const name = (lines[i] ?? '').trim();
  i++;

  // Contact = consecutive non-blank lines (up to 4) before the first section header.
  const contactLines: string[] = [];
  while (i < lines.length && contactLines.length < 4) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t) { i++; continue; }
    if (isSectionHeader(raw)) break;
    contactLines.push(t);
    i++;
    // Stop at first blank after we've collected at least one line.
    if (contactLines.length > 0 && i < lines.length && lines[i].trim() === '') {
      i++;
      // peek forward — if next non-blank is a header, stop; else allow more
      let j = i;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j < lines.length && isSectionHeader(lines[j])) break;
    }
  }

  // Collect sections.
  const sections: Section[] = [];
  let currentHeader: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentHeader === null) return;
    sections.push(buildSection(currentHeader, buffer));
    buffer = [];
  };

  for (; i < lines.length; i++) {
    const raw = lines[i];
    if (isSectionHeader(raw)) {
      flush();
      currentHeader = raw.trim();
      continue;
    }
    if (currentHeader !== null) buffer.push(raw);
  }
  flush();

  return { name, contactLines, sections };
}

function buildSection(title: string, lines: string[]): Section {
  const kind = sectionKind(title);
  const section: Section = { title, kind, entries: [], skills: [], coursework: [] };

  if (kind === 'skills') {
    for (const raw of lines) {
      const t = raw.trim();
      if (!t) continue;
      const parsed = parseSkillLine(t);
      if (parsed) section.skills.push(parsed);
      else section.skills.push({ category: '', items: t });
    }
    return section;
  }

  if (kind === 'coursework') {
    for (const raw of lines) {
      let t = raw.trim();
      if (!t) continue;
      if (isBullet(raw)) t = stripBullet(raw);
      // If line has commas, treat as a list of courses.
      if (t.includes(',') && !/[A-Z]\.\s/.test(t)) {
        for (const item of t.split(/\s*,\s*/)) {
          const v = item.trim();
          if (v) section.coursework.push(v);
        }
      } else {
        section.coursework.push(t);
      }
    }
    return section;
  }

  // subheading or project
  let entry: Entry | null = null;
  const flushEntry = () => {
    if (entry) section.entries.push(entry);
    entry = null;
  };

  for (let k = 0; k < lines.length; k++) {
    const raw = lines[k];
    const t = raw.trim();
    if (!t) {
      // Blank line ends the bullet block but doesn't always end the entry — keep entry
      // open in case more bullets follow. We'll only flush when a new entry header is detected.
      continue;
    }

    if (isBullet(raw)) {
      if (!entry) entry = { title: '', bullets: [] };
      entry.bullets.push(stripBullet(raw));
      continue;
    }

    if (kind === 'project') {
      // Each non-bullet line starts a new project entry.
      flushEntry();
      const { left, right } = splitTitleAndRight(t);
      let projectTitle = left;
      let techStack: string | undefined;
      // Pipe-separated: "Project Name | Tech, Stack"
      const pipeIdx = left.search(/\s+[|·]\s+/);
      if (pipeIdx !== -1) {
        projectTitle = left.slice(0, pipeIdx).trim();
        techStack = left.slice(pipeIdx).replace(/^\s+[|·]\s+/, '').trim();
      }
      entry = { title: projectTitle, techStack, date: right, bullets: [] };
      continue;
    }

    // subheading
    if (!entry || (entry.bullets.length > 0) || (entry.subtitle !== undefined && entry.title !== '')) {
      // Start a new entry: this is the title+date row.
      flushEntry();
      const { left, right } = splitTitleAndRight(t);
      entry = { title: left, date: right, bullets: [] };
    } else if (entry.title === '') {
      // Entry was opened by a stray bullet — backfill the title row.
      const { left, right } = splitTitleAndRight(t);
      entry.title = left;
      entry.date = right;
    } else {
      // Second non-bullet line under the current entry → subtitle + location.
      const { left, right } = splitTitleAndRight(t);
      entry.subtitle = left;
      entry.location = right;
    }
  }
  flushEntry();
  return section;
}

// ------------------------------------------------------------
// HTML escaping
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
  const want = ['EDUCATION', 'PROJECTS', 'SKILLS', 'TECHNICAL SKILLS', 'EXPERIENCE'];
  const score = (title: string) => {
    const idx = want.indexOf(title.toUpperCase());
    return idx === -1 ? want.length + 1 : idx;
  };
  return [...sections].sort((a, b) => score(a.title) - score(b.title));
}

// ------------------------------------------------------------
// Shared CSS
// ------------------------------------------------------------
const SHARED_RESET = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  ul { margin: 2px 0 0 0; padding: 0 0 0 16px; }
  li { margin: 1px 0; }
  p { margin: 0; }
`;

// ============================================================
// JAKE'S TEMPLATE
// ============================================================
// Faithful port of Jake Gutierrez's LaTeX template:
//   - Centered name in small-caps, contact line below with pipe separators
//   - Section headers in small-caps with a horizontal rule
//   - Two-column entry rows: title bold left / date bold right,
//     subtitle italic left / location italic right
//   - Projects: "Name | Tech Stack" left, date bold right
//   - Skills: "Category: items" with bold category
//   - Coursework: multi-column bulleted list
// ============================================================
function renderJake(r: ParsedResume): string {
  const renderEntry = (e: Entry, kind: SectionKind): string => {
    const titleRow = `
      <div class="row">
        <div class="left"><strong>${esc(e.title)}</strong>${
          e.techStack ? ` <span class="tech">| <em>${esc(e.techStack)}</em></span>` : ''
        }</div>
        ${e.date ? `<div class="right"><strong>${esc(e.date)}</strong></div>` : ''}
      </div>`;
    const subRow = (e.subtitle || e.location)
      ? `<div class="row sub">
          <div class="left"><em>${esc(e.subtitle ?? '')}</em></div>
          ${e.location ? `<div class="right"><em>${esc(e.location)}</em></div>` : ''}
        </div>`
      : '';
    const bullets = e.bullets.length
      ? `<ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`
      : '';
    return `<div class="entry ${kind}">${titleRow}${subRow}${bullets}</div>`;
  };

  const renderSection = (s: Section): string => {
    let body = '';
    if (s.kind === 'skills') {
      body = `<div class="skills">${s.skills.map((sk) => sk.category
        ? `<div class="skill-line"><strong>${esc(sk.category)}</strong>: ${esc(sk.items)}</div>`
        : `<div class="skill-line">${esc(sk.items)}</div>`
      ).join('')}</div>`;
    } else if (s.kind === 'coursework') {
      const cols = chunk(s.coursework, Math.ceil(s.coursework.length / 4) || 1);
      body = `<div class="coursework">${cols.map((col) =>
        `<ul>${col.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`
      ).join('')}</div>`;
    } else {
      body = s.entries.map((e) => renderEntry(e, s.kind)).join('');
    }
    return `<section class="sec"><h2>${esc(s.title)}</h2>${body}</section>`;
  };

  const contact = r.contactLines.length
    ? r.contactLines.map((c) => `<div class="contact-line">${esc(c)}</div>`).join('')
    : '';

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${SHARED_RESET}
    body {
      font-family: 'Latin Modern Roman', 'Computer Modern', 'Times New Roman', Times, serif;
      font-size: 10.5pt; line-height: 1.25; padding: 0.4in 0.55in;
    }
    header { text-align: center; margin-bottom: 6px; }
    header .name {
      font-size: 24pt; font-weight: 400; letter-spacing: 1.5px;
      font-variant: small-caps; line-height: 1.1;
    }
    header .contact-line { font-size: 9.5pt; margin-top: 2px; color: #111; }
    .sec { margin-top: 8px; }
    .sec h2 {
      font-size: 11pt; font-weight: 700; font-variant: small-caps; letter-spacing: 0.5px;
      margin: 0 0 3px 0; padding-bottom: 1px;
      border-bottom: 0.6pt solid #111;
    }
    .entry { margin-top: 3px; padding-left: 2px; }
    .entry .row { display: flex; justify-content: space-between; gap: 12px; }
    .entry .row .left { flex: 1; min-width: 0; }
    .entry .row .right { flex-shrink: 0; white-space: nowrap; }
    .entry .row.sub { margin-top: 0; }
    .entry ul { list-style: disc; margin-left: 18px; padding-left: 0; }
    .entry li { font-size: 10pt; margin: 1px 0; }
    .entry .tech { font-weight: 400; }
    .skills { padding-left: 4px; }
    .skill-line { font-size: 10.5pt; margin: 1px 0; }
    .coursework {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 0 16px; padding-left: 4px;
    }
    .coursework ul { list-style: disc; margin: 0 0 0 14px; padding: 0; }
    .coursework li { font-size: 9.5pt; margin: 1px 0; }
  </style></head><body>
    <header>
      <div class="name">${esc(r.name)}</div>
      ${contact}
    </header>
    ${r.sections.map(renderSection).join('')}
  </body></html>`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ============================================================
// COMPACT
// ============================================================
function renderCompact(r: ParsedResume): string {
  const renderEntry = (e: Entry): string => {
    const head = `<div class="entry-head">
      <div><strong>${esc(e.title)}</strong>${e.techStack ? ` <em>· ${esc(e.techStack)}</em>` : ''}${e.subtitle ? ` — <em>${esc(e.subtitle)}</em>` : ''}</div>
      <div class="meta">${[e.date, e.location].filter(Boolean).map(esc).join(' · ')}</div>
    </div>`;
    const bullets = e.bullets.length
      ? `<ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`
      : '';
    return `<div class="entry">${head}${bullets}</div>`;
  };

  const renderSection = (s: Section): string => {
    let body = '';
    if (s.kind === 'skills') {
      body = s.skills.map((sk) => sk.category
        ? `<div class="skill"><strong>${esc(sk.category)}:</strong> ${esc(sk.items)}</div>`
        : `<div class="skill">${esc(sk.items)}</div>`
      ).join('');
    } else if (s.kind === 'coursework') {
      body = `<div class="coursework">${s.coursework.map(esc).join(' · ')}</div>`;
    } else {
      body = s.entries.map(renderEntry).join('');
    }
    return `<section class="sec"><h2>${esc(s.title)}</h2>${body}</section>`;
  };

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${SHARED_RESET}
    body { font-family: Georgia, 'Times New Roman', serif; font-size: 10pt; line-height: 1.28; padding: 0.4in 0.5in; }
    header { margin-bottom: 6px; border-bottom: 2px solid #111; padding-bottom: 4px; }
    header .name { font-size: 18pt; font-weight: 700; letter-spacing: 0.3px; }
    header .contact-line { font-size: 9pt; color: #333; margin-top: 1px; }
    .sec { margin-top: 8px; }
    .sec h2 {
      font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;
      margin: 0 0 3px 0; color: #111;
    }
    .entry { margin-top: 4px; }
    .entry-head { display: flex; justify-content: space-between; gap: 10px; }
    .entry-head .meta { font-size: 9pt; color: #555; white-space: nowrap; }
    ul { list-style: disc; margin: 2px 0 0 14px; padding: 0; }
    li { font-size: 9.5pt; color: #222; }
    .skill { font-size: 9.5pt; margin: 1px 0; }
    .coursework { font-size: 9.5pt; color: #222; }
  </style></head><body>
    <header>
      <div class="name">${esc(r.name)}</div>
      ${r.contactLines.map((c) => `<div class="contact-line">${esc(c)}</div>`).join('')}
    </header>
    ${r.sections.map(renderSection).join('')}
  </body></html>`;
}

// ============================================================
// MODERN
// ============================================================
function renderModern(r: ParsedResume): string {
  const sidebarKinds = (s: Section) =>
    s.kind === 'skills' || s.kind === 'coursework' ||
    /CONTACT|LANGUAGES|INTERESTS|HOBBIES/.test(s.title.toUpperCase());
  const sidebar = r.sections.filter(sidebarKinds);
  const main = r.sections.filter((s) => !sidebarKinds(s));

  const renderMainEntry = (e: Entry) => `
    <div class="entry">
      <div class="row">
        <div><strong>${esc(e.title)}</strong>${e.techStack ? ` <span class="tech">· ${esc(e.techStack)}</span>` : ''}</div>
        ${e.date ? `<div class="meta">${esc(e.date)}</div>` : ''}
      </div>
      ${e.subtitle || e.location ? `<div class="row sub">
        <div><em>${esc(e.subtitle ?? '')}</em></div>
        ${e.location ? `<div class="meta"><em>${esc(e.location)}</em></div>` : ''}
      </div>` : ''}
      ${e.bullets.length ? `<ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
    </div>`;

  const renderSidebar = (s: Section): string => {
    if (s.kind === 'skills') {
      return `<section class="sec"><h2>${esc(s.title)}</h2>${s.skills.map((sk) =>
        sk.category
          ? `<div class="sk"><div class="cat">${esc(sk.category)}</div><div class="items">${esc(sk.items)}</div></div>`
          : `<div class="sk"><div class="items">${esc(sk.items)}</div></div>`
      ).join('')}</section>`;
    }
    if (s.kind === 'coursework') {
      return `<section class="sec"><h2>${esc(s.title)}</h2><div class="cw">${s.coursework.map(esc).join(', ')}</div></section>`;
    }
    return `<section class="sec"><h2>${esc(s.title)}</h2>${s.entries.map((e) =>
      `<div class="entry"><strong>${esc(e.title)}</strong>${e.date ? ` <span class="meta">${esc(e.date)}</span>` : ''}</div>`
    ).join('')}</section>`;
  };

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${SHARED_RESET}
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10.5pt; line-height: 1.4; padding: 0.45in 0.5in; }
    .grid { display: flex; gap: 22px; }
    aside { width: 33%; }
    main { flex: 1; min-width: 0; }
    .name { font-size: 22pt; font-weight: 700; letter-spacing: 0.4px; line-height: 1.05; }
    .contact-line { font-size: 9.5pt; margin-top: 4px; color: #333; }
    .sec { margin-top: 14px; }
    .sec h2 {
      font-size: 9.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;
      margin: 0 0 6px 0; color: #B8451F;
    }
    .entry { margin-top: 7px; }
    .row { display: flex; justify-content: space-between; gap: 10px; }
    .row.sub { margin-top: 1px; }
    .meta { font-size: 9.5pt; color: #444; white-space: nowrap; }
    .tech { font-weight: 400; color: #555; }
    ul { list-style: disc; margin: 3px 0 0 16px; padding: 0; }
    li { font-size: 10pt; }
    aside .sk { margin-bottom: 6px; }
    aside .cat { font-weight: 600; font-size: 10pt; }
    aside .items { font-size: 9.5pt; color: #222; }
    aside .cw { font-size: 9.5pt; color: #222; }
  </style></head><body>
    <div class="grid">
      <aside>
        <div class="name">${esc(r.name)}</div>
        ${r.contactLines.map((c) => `<div class="contact-line">${esc(c)}</div>`).join('')}
        ${sidebar.map(renderSidebar).join('')}
      </aside>
      <main>
        ${main.map((s) => `<section class="sec"><h2>${esc(s.title)}</h2>${s.entries.map(renderMainEntry).join('')}</section>`).join('')}
      </main>
    </div>
  </body></html>`;
}

// ============================================================
// TECH
// ============================================================
function renderTech(r: ParsedResume): string {
  const ordered = reorderForTech(r.sections);

  const renderEntry = (e: Entry): string => `
    <div class="entry">
      <div class="row">
        <div><strong>${esc(e.title)}</strong>${e.techStack ? ` <span class="mono tech">[${esc(e.techStack)}]</span>` : ''}</div>
        ${e.date ? `<div class="mono meta">${esc(e.date)}</div>` : ''}
      </div>
      ${e.subtitle || e.location ? `<div class="row sub">
        <div><em>${esc(e.subtitle ?? '')}</em></div>
        ${e.location ? `<div class="mono meta">${esc(e.location)}</div>` : ''}
      </div>` : ''}
      ${e.bullets.length ? `<ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
    </div>`;

  const renderSection = (s: Section): string => {
    let body = '';
    if (s.kind === 'skills') {
      body = s.skills.map((sk) => sk.category
        ? `<div class="skill"><span class="mono cat">${esc(sk.category)}:</span> ${esc(sk.items)}</div>`
        : `<div class="skill">${esc(sk.items)}</div>`
      ).join('');
    } else if (s.kind === 'coursework') {
      body = `<div class="coursework mono">${s.coursework.map(esc).join(' · ')}</div>`;
    } else {
      body = s.entries.map(renderEntry).join('');
    }
    return `<section class="sec"><h2 class="mono">// ${esc(s.title.toLowerCase())}</h2>${body}</section>`;
  };

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
      font-size: 10pt; font-weight: 600; letter-spacing: 0.5px;
      margin: 0 0 5px 0; color: #2B5573;
    }
    .entry { margin-top: 6px; }
    .row { display: flex; justify-content: space-between; gap: 12px; }
    .row.sub { margin-top: 1px; }
    .meta { font-size: 9.5pt; color: #444; white-space: nowrap; }
    .tech { color: #555; font-size: 9.5pt; }
    ul { list-style: square; margin: 3px 0 0 18px; padding: 0; }
    li { font-size: 10pt; }
    .skill { margin: 2px 0; }
    .skill .cat { color: #2B5573; }
    .coursework { font-size: 9.5pt; color: #333; }
  </style></head><body>
    <header>
      <div class="name">${esc(r.name)}</div>
      <div class="contact">${r.contactLines.map(esc).join('<br>')}</div>
    </header>
    ${ordered.map(renderSection).join('')}
  </body></html>`;
}

// ------------------------------------------------------------
export function renderTemplate(text: string, template: TemplateId): string {
  const parsed = parseResume(text);
  switch (template) {
    case 'jake':    return renderJake(parsed);
    case 'compact': return renderCompact(parsed);
    case 'modern':  return renderModern(parsed);
    case 'tech':    return renderTech(parsed);
  }
}
