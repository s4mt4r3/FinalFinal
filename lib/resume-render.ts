// ============================================================
// lib/resume-render.ts
// ============================================================
// Renders a composed resume (an ordered list of section variants)
// into three faithful outputs:
//
//   renderHtml(...)   — a self-contained HTML document that mirrors
//                       jake.txt's layout. Used for the live preview
//                       and html2pdf export. Accepts a `scale` knob
//                       so the builder can shrink it to fit one page.
//
//   renderLatex(...)  — genuine Jake-style LaTeX source (.tex) built
//                       from the same structured data. Compile on
//                       Overleaf for a pixel-exact, ATS-parseable PDF.
//
//   renderText(...)   — clean plain text, stored as the resumes.content
//                       cache so keyword-match / .txt export keep working.
//
// Everything is driven by structured data — there is no parsing.
// ============================================================

import type {
  SectionKind,
  HeaderData,
  EducationData,
  CourseworkData,
  ExperienceData,
  ProjectsData,
  SkillsData,
  LeadershipData,
} from './sections';
import { SECTION_TITLE } from './sections';

export interface ComposedSection {
  kind: SectionKind;
  title: string; // section header text (defaults to canonical)
  data: any;
}
export type Composition = ComposedSection[];

// ------------------------------------------------------------
// Escaping
// ------------------------------------------------------------
function htmlEsc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function latexEsc(s: string): string {
  return String(s ?? '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

const nonEmpty = (arr: any[]) => (arr || []).filter((b) => String(b ?? '').trim() !== '');

// ============================================================
// HTML — faithful facsimile of jake.txt
// ============================================================
export function renderHtml(comp: Composition, opts: { scale?: number } = {}): string {
  const scale = opts.scale ?? 1;
  const base = (10.6 * scale).toFixed(3); // body font size in pt; the single fit knob

  const header = comp.find((s) => s.kind === 'header')?.data as HeaderData | undefined;
  const body = comp.filter((s) => s.kind !== 'header');

  const headHtml = header ? renderHeaderHtml(header) : '';
  const sectionsHtml = body.map((s) => renderSectionHtml(s)).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      color: #000;
      background: #fff;
      font-family: 'Latin Modern Roman', 'CMU Serif', Georgia, 'Times New Roman', Times, serif;
      font-size: ${base}pt;
      line-height: 1.05;
      padding: 0.42in 0.5in 0.3in;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    a { color: #000; text-decoration: none; }
    p { margin: 0; }

    /* heading */
    .head { text-align: center; margin-bottom: 0.4em; }
    .head .name {
      font-size: 2.35em; font-weight: 400; letter-spacing: 1px;
      font-variant: small-caps; line-height: 1.0;
    }
    .head .addr { font-size: 0.98em; margin-top: 0.35em; }
    .head .contact { font-size: 0.98em; margin-top: 0.25em; }
    .head .contact .u { text-decoration: underline; }
    .head .contact .sep { padding: 0 0.35em; }

    /* sections */
    .sec { margin-top: 0.55em; }
    .sec > h2 {
      font-size: 1.18em; font-weight: 700; font-variant: small-caps;
      letter-spacing: 0.5px; margin: 0 0 0.1em 0; padding-bottom: 0.04em;
      border-bottom: 0.5pt solid #000;
    }

    /* two-column subheading (experience / education / leadership) */
    .item { margin: 0.28em 0 0.18em; padding-left: 0.04in; }
    .item .row { display: flex; justify-content: space-between; align-items: baseline; gap: 1em; }
    .item .row .l { min-width: 0; }
    .item .row .r { flex-shrink: 0; white-space: nowrap; text-align: right; }
    .item .b { font-weight: 700; }
    .item .i { font-style: italic; }
    .item .row.sub { margin-top: 0.02em; }

    /* project heading */
    .proj .row .l .tech { font-style: italic; }

    /* bullets */
    ul.items { list-style: disc; margin: 0.12em 0 0 0; padding-left: 0.28in; }
    ul.items li { margin: 0.04em 0; padding-left: 0.04in; }

    /* skills */
    .skills { padding-left: 0.04in; }
    .skills .line { margin: 0.06em 0; }
    .skills .cat { font-weight: 700; }

    /* coursework (4-column) */
    .coursework {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 0 0.5em; padding-left: 0.18in; margin-top: 0.1em;
    }
    .coursework ul { list-style: disc; margin: 0; padding-left: 0.16in; }
    .coursework li { margin: 0.02em 0; }
  </style></head><body>${headHtml}${sectionsHtml}</body></html>`;
}

function renderHeaderHtml(h: HeaderData): string {
  const link = (v: string) => `<span class="u">${htmlEsc(v)}</span>`;
  const parts: string[] = [];
  if (h.phone) parts.push(htmlEsc(h.phone));
  if (h.email) parts.push(link(h.email));
  if (h.linkedin) parts.push(link(h.linkedin));
  if (h.github) parts.push(link(h.github));
  if (h.website) parts.push(link(h.website));
  const contact = parts.join('<span class="sep">|</span>');
  return `<header class="head">
    <div class="name">${htmlEsc(h.name || 'Your Name')}</div>
    ${h.location ? `<div class="addr">${htmlEsc(h.location)}</div>` : ''}
    ${contact ? `<div class="contact">${contact}</div>` : ''}
  </header>`;
}

function subheadingHtml(left1: string, right1: string, left2: string, right2: string, bullets: string[], cls = ''): string {
  const b = nonEmpty(bullets);
  return `<div class="item ${cls}">
    <div class="row"><span class="l b">${htmlEsc(left1)}</span>${right1 ? `<span class="r b">${htmlEsc(right1)}</span>` : ''}</div>
    ${(left2 || right2) ? `<div class="row sub"><span class="l i">${htmlEsc(left2)}</span>${right2 ? `<span class="r i">${htmlEsc(right2)}</span>` : ''}</div>` : ''}
    ${b.length ? `<ul class="items">${b.map((x) => `<li>${htmlEsc(x)}</li>`).join('')}</ul>` : ''}
  </div>`;
}

function renderSectionHtml(s: ComposedSection): string {
  const title = `<h2>${htmlEsc(s.title || SECTION_TITLE[s.kind])}</h2>`;
  let body = '';

  switch (s.kind) {
    case 'education': {
      const d = s.data as EducationData;
      body = (d.items || []).map((it) =>
        subheadingHtml(it.school, it.dateRange, it.degree, it.location, [])
      ).join('');
      break;
    }
    case 'experience': {
      const d = s.data as ExperienceData;
      body = (d.items || []).map((it) =>
        subheadingHtml(it.company, it.dateRange, it.title, it.location, it.bullets || [])
      ).join('');
      break;
    }
    case 'leadership': {
      const d = s.data as LeadershipData;
      body = (d.items || []).map((it) =>
        subheadingHtml(it.organization, it.dateRange, it.role, it.location, it.bullets || [])
      ).join('');
      break;
    }
    case 'projects': {
      const d = s.data as ProjectsData;
      body = (d.items || []).map((it) => {
        const b = nonEmpty(it.bullets || []);
        const head = `<div class="row"><span class="l"><span class="b">${htmlEsc(it.name)}</span>${it.tech ? ` <span class="tech">| ${htmlEsc(it.tech)}</span>` : ''}</span>${it.date ? `<span class="r b">${htmlEsc(it.date)}</span>` : ''}</div>`;
        return `<div class="item proj">${head}${b.length ? `<ul class="items">${b.map((x) => `<li>${htmlEsc(x)}</li>`).join('')}</ul>` : ''}</div>`;
      }).join('');
      break;
    }
    case 'skills': {
      const d = s.data as SkillsData;
      body = `<div class="skills">${(d.categories || []).filter((c) => c.category || c.items).map((c) =>
        `<div class="line">${c.category ? `<span class="cat">${htmlEsc(c.category)}</span>: ` : ''}${htmlEsc(c.items)}</div>`
      ).join('')}</div>`;
      break;
    }
    case 'coursework': {
      const d = s.data as CourseworkData;
      const courses = nonEmpty(d.courses || []);
      const cols = chunkColumns(courses, 4);
      body = `<div class="coursework">${cols.map((col) =>
        `<ul>${col.map((c) => `<li>${htmlEsc(c)}</li>`).join('')}</ul>`
      ).join('')}</div>`;
      break;
    }
  }

  return `<section class="sec">${title}${body}</section>`;
}

// Split into N balanced columns (down-then-across, like LaTeX multicol).
function chunkColumns<T>(arr: T[], n: number): T[][] {
  if (arr.length === 0) return [];
  const perCol = Math.ceil(arr.length / n);
  const cols: T[][] = [];
  for (let i = 0; i < arr.length; i += perCol) cols.push(arr.slice(i, i + perCol));
  return cols;
}

// ============================================================
// LaTeX — genuine jake.txt output
// ============================================================
const LATEX_PREAMBLE = String.raw`%-------------------------
% Resume in Latex
% Based on Jake Gutierrez's template (MIT). Generated by FinalFinal.
%------------------------

\documentclass[letterpaper,11pt]{article}

\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{marvosym}
\usepackage[usenames,dvipsnames]{color}
\usepackage{verbatim}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage[english]{babel}
\usepackage{tabularx}
\usepackage{fontawesome5}
\usepackage{multicol}
\setlength{\multicolsep}{-3.0pt}
\setlength{\columnsep}{-1pt}
\input{glyphtounicode}

\pagestyle{fancy}
\fancyhf{}
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

\addtolength{\oddsidemargin}{-0.6in}
\addtolength{\evensidemargin}{-0.5in}
\addtolength{\textwidth}{1.19in}
\addtolength{\topmargin}{-.7in}
\addtolength{\textheight}{1.4in}

\urlstyle{same}

\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

\titleformat{\section}{
  \vspace{-4pt}\scshape\raggedright\large\bfseries
}{}{0em}{}[\color{black}\titlerule \vspace{-5pt}]

\pdfgentounicode=1

\newcommand{\resumeItem}[1]{
  \item\small{
    {#1 \vspace{-2pt}}
  }
}

\newcommand{\classesList}[4]{
    \item\small{
        {#1 #2 #3 #4 \vspace{-2pt}}
  }
}

\newcommand{\resumeSubheading}[4]{
  \vspace{-2pt}\item
    \begin{tabular*}{1.0\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & \textbf{\small #2} \\
      \textit{\small#3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubSubheading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \textit{\small#1} & \textit{\small #2} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeProjectHeading}[2]{
    \item
    \begin{tabular*}{1.001\textwidth}{l@{\extracolsep{\fill}}r}
      \small#1 & \textbf{\small #2}\\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubItem}[1]{\resumeItem{#1}\vspace{-4pt}}

\renewcommand\labelitemi{$\vcenter{\hbox{\tiny$\bullet$}}$}
\renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}

\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.0in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}

%-------------------------------------------
\begin{document}
`;

export function renderLatex(comp: Composition): string {
  const header = comp.find((s) => s.kind === 'header')?.data as HeaderData | undefined;
  const body = comp.filter((s) => s.kind !== 'header');

  const out: string[] = [LATEX_PREAMBLE];

  if (header) out.push(renderHeaderLatex(header));

  for (const s of body) out.push(renderSectionLatex(s));

  out.push('\n\\end{document}\n');
  return out.join('\n');
}

function renderHeaderLatex(h: HeaderData): string {
  const lines: string[] = [];
  lines.push('\\begin{center}');
  lines.push(`    {\\Huge \\scshape ${latexEsc(h.name || 'First Last')}} \\\\ \\vspace{1pt}`);
  if (h.location) lines.push(`    ${latexEsc(h.location)} \\\\ \\vspace{1pt}`);

  const contactBits: string[] = [];
  if (h.phone) contactBits.push(`\\raisebox{-0.1\\height}\\faPhone\\ ${latexEsc(h.phone)}`);
  if (h.email) contactBits.push(`\\href{mailto:${h.email}}{\\raisebox{-0.2\\height}\\faEnvelope\\  \\underline{${latexEsc(h.email)}}}`);
  if (h.linkedin) contactBits.push(`\\href{https://${h.linkedin}}{\\raisebox{-0.2\\height}\\faLinkedin\\ \\underline{${latexEsc(h.linkedin)}}}`);
  if (h.github) contactBits.push(`\\href{https://${h.github}}{\\raisebox{-0.2\\height}\\faGithub\\ \\underline{${latexEsc(h.github)}}}`);
  if (h.website) contactBits.push(`\\href{https://${h.website}}{\\raisebox{-0.2\\height}\\faGlobe\\ \\underline{${latexEsc(h.website)}}}`);
  if (contactBits.length) {
    lines.push('    \\small ' + contactBits.join(' ~ '));
  }
  lines.push('    \\vspace{-8pt}');
  lines.push('\\end{center}');
  return lines.join('\n');
}

function bulletsLatex(bullets: string[]): string {
  const b = nonEmpty(bullets);
  if (!b.length) return '';
  return [
    '      \\resumeItemListStart',
    ...b.map((x) => `        \\resumeItem{${latexEsc(x)}}`),
    '      \\resumeItemListEnd',
  ].join('\n');
}

function renderSectionLatex(s: ComposedSection): string {
  const title = latexEsc(s.title || SECTION_TITLE[s.kind]);
  const head = `\n\\section{${title}}`;

  switch (s.kind) {
    case 'education': {
      const d = s.data as EducationData;
      const items = (d.items || []).map((it) =>
        `    \\resumeSubheading\n      {${latexEsc(it.school)}}{${latexEsc(it.dateRange)}}\n      {${latexEsc(it.degree)}}{${latexEsc(it.location)}}`
      ).join('\n');
      return `${head}\n  \\resumeSubHeadingListStart\n${items}\n  \\resumeSubHeadingListEnd`;
    }
    case 'experience': {
      const d = s.data as ExperienceData;
      const items = (d.items || []).map((it) =>
        `    \\resumeSubheading\n      {${latexEsc(it.company)}}{${latexEsc(it.dateRange)}}\n      {${latexEsc(it.title)}}{${latexEsc(it.location)}}\n${bulletsLatex(it.bullets || [])}`
      ).join('\n\n');
      return `${head}\n  \\resumeSubHeadingListStart\n\n${items}\n\n  \\resumeSubHeadingListEnd`;
    }
    case 'leadership': {
      const d = s.data as LeadershipData;
      const items = (d.items || []).map((it) =>
        `    \\resumeSubheading{${latexEsc(it.organization)}}{${latexEsc(it.dateRange)}}{${latexEsc(it.role)}}{${latexEsc(it.location)}}\n${bulletsLatex(it.bullets || [])}`
      ).join('\n\n');
      return `${head}\n  \\resumeSubHeadingListStart\n${items}\n  \\resumeSubHeadingListEnd`;
    }
    case 'projects': {
      const d = s.data as ProjectsData;
      const items = (d.items || []).map((it) => {
        const headingArg = it.tech
          ? `{\\textbf{${latexEsc(it.name)}} $|$ \\emph{${latexEsc(it.tech)}}}`
          : `{\\textbf{${latexEsc(it.name)}}}`;
        return `      \\resumeProjectHeading\n          ${headingArg}{${latexEsc(it.date)}}\n${bulletsLatex(it.bullets || [])}`;
      }).join('\n          \\vspace{-13pt}\n');
      return `${head}\n    \\vspace{-5pt}\n    \\resumeSubHeadingListStart\n${items}\n    \\resumeSubHeadingListEnd`;
    }
    case 'skills': {
      const d = s.data as SkillsData;
      const cats = (d.categories || []).filter((c) => c.category || c.items);
      const lines = cats.map((c, i) => {
        const sep = i < cats.length - 1 ? ' \\\\' : '';
        return `     \\textbf{${latexEsc(c.category)}}{: ${latexEsc(c.items)}}${sep}`;
      }).join('\n');
      return `${head}\n \\begin{itemize}[leftmargin=0.15in, label={}]\n    \\small{\\item{\n${lines}\n    }}\n \\end{itemize}`;
    }
    case 'coursework': {
      const d = s.data as CourseworkData;
      const courses = nonEmpty(d.courses || []);
      const items = courses.map((c) => `                \\item\\small ${latexEsc(c)}`).join('\n');
      return `${head}\n        \\begin{multicols}{4}\n            \\begin{itemize}[itemsep=-5pt, parsep=3pt]\n${items}\n            \\end{itemize}\n        \\end{multicols}\n        \\vspace*{2.0\\multicolsep}`;
    }
  }
  return head;
}

// ============================================================
// Plain text — content cache (keyword match + .txt export)
// ============================================================
const TXT_W = 78;

function txtCenter(s: string): string {
  const pad = Math.max(0, Math.floor((TXT_W - s.length) / 2));
  return ' '.repeat(pad) + s;
}
function txtRow(left: string, right: string): string {
  if (!right) return left;
  const gap = TXT_W - left.length - right.length;
  return gap > 1 ? left + ' '.repeat(gap) + right : `${left}  ${right}`;
}

export function renderText(comp: Composition): string {
  const out: string[] = [];
  const header = comp.find((s) => s.kind === 'header')?.data as HeaderData | undefined;
  if (header) {
    out.push(txtCenter(header.name || ''));
    const bits = [header.location, header.phone, header.email, header.linkedin, header.github, header.website].filter(Boolean);
    if (bits.length) out.push(txtCenter(bits.join(' | ')));
  }

  for (const s of comp.filter((x) => x.kind !== 'header')) {
    out.push('');
    out.push((s.title || SECTION_TITLE[s.kind]).toUpperCase());
    out.push('-'.repeat(TXT_W));

    switch (s.kind) {
      case 'education':
        for (const it of (s.data as EducationData).items || []) {
          out.push(txtRow(it.school, it.dateRange));
          out.push(txtRow('  ' + it.degree, it.location));
        }
        break;
      case 'experience':
        for (const it of (s.data as ExperienceData).items || []) {
          out.push(txtRow(it.company, it.dateRange));
          out.push(txtRow('  ' + it.title, it.location));
          for (const b of nonEmpty(it.bullets)) out.push('  • ' + b);
        }
        break;
      case 'leadership':
        for (const it of (s.data as LeadershipData).items || []) {
          out.push(txtRow(it.organization, it.dateRange));
          out.push(txtRow('  ' + it.role, it.location));
          for (const b of nonEmpty(it.bullets)) out.push('  • ' + b);
        }
        break;
      case 'projects':
        for (const it of (s.data as ProjectsData).items || []) {
          out.push(txtRow(it.name + (it.tech ? ` | ${it.tech}` : ''), it.date));
          for (const b of nonEmpty(it.bullets)) out.push('  • ' + b);
        }
        break;
      case 'skills':
        for (const c of (s.data as SkillsData).categories || []) {
          if (c.category || c.items) out.push(`${c.category}: ${c.items}`);
        }
        break;
      case 'coursework':
        out.push(nonEmpty((s.data as CourseworkData).courses).join(', '));
        break;
    }
  }
  out.push('');
  return out.join('\n');
}
