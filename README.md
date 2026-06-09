# FinalFinal — Section-Based Resume Builder

Build a pixel-faithful, ATS-friendly resume by composing reusable **sections** instead of editing one giant text blob. Keep multiple variants of each section, mix and match them per role, and export to PDF or genuine LaTeX — all while tracking the applications and interviews each resume earns.

Every feature is free and available to every user.

## Concept

A great resume isn't one document — it's a *library of parts* you recombine for each application. FinalFinal makes that explicit:

- **Sections are the unit.** Header, Education, Experience, Projects, Technical Skills, Relevant Coursework, and Leadership / Extracurricular are each edited through guided, structured fields — not freeform text.
- **Variants are the "branches."** Keep a quant-flavored Experience and a full-stack one; a research-heavy Projects list and a shipping-heavy one. Each variant lives in your **Section Library**.
- **Resumes are compositions.** The **Builder** assembles a tailored resume by picking one variant per section and ordering them. A live preview **auto-shrinks the font to fit a single page**, the way recruiters and ATS parsers expect.
- **Output matches the canonical [Jake Gutierrez LaTeX template](https://github.com/jakegut/resume).** Export a faithful HTML→PDF, or download real `.tex` source and compile it on Overleaf for a pixel-exact result.

Then track what works: link each application to the resume you sent, log interview rounds, and watch callback rates per resume.

## Features

### Resume building
- **Section Library** — Create, edit, duplicate, and delete variants of each section through guided editors with field-level hints (company, dates, location, bullets, tech stack, …).
- **Builder** — Compose a resume by choosing a variant per section, reorder sections, and name/tag it.
- **One-page auto-fit** — The live preview measures the rendered page and scales typography down to fit a single Letter page, with a readable floor.
- **Faithful rendering** — A Jake-style HTML facsimile drives the on-screen preview and PDF export; the same structured data emits genuine Jake LaTeX.
- **Export** — Download as **PDF** (in-browser, no server PDF toolchain needed) or **`.tex`** source for Overleaf.

### Keyword / JD matching
- Paste a job description and see which of its keywords your resume already hits and which it's missing — so you can tailor a variant before applying.

### Application tracking
- Track every application: company, role, status (applied / interviewing / offer / rejected / ghosted), date, and notes.
- Link each application to the exact resume you submitted.
- Search and filter by status, company, or resume.

### Interview tracking
- Log interview rounds per application — kind (phone screen, technical, onsite, …), scheduled time, outcome, and notes.

### Analytics
- Callback and response rates overall and per resume, so you can see which compositions land interviews.

## Tech stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Custom CSS design system injected at runtime (paper / terracotta palette, Fraunces serif + IBM Plex Mono)
- **Backend**: Next.js API routes with Zod validation
- **Database**: Supabase (PostgreSQL) with Row-Level Security
- **Auth**: Supabase Auth + Google OAuth
- **Rendering**: Pure TS renderers (HTML / LaTeX / plain text) + `html2pdf.js` for client-side PDF
- **Deployment**: Vercel

## Quick start

### 1. Clone & install

```bash
git clone https://github.com/s4mt4r3/FinalFinal.git
cd FinalFinal
npm install
```

### 2. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. **Settings → API** → copy your **Project URL** and **anon key**.
3. Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # optional, for server-only ops
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run migrations

In the Supabase **SQL Editor**, run each file in `supabase/migrations/` in order (`0001` → `0008`), or use the Supabase CLI:

```bash
supabase db push
```

The section model lives in `0008_sections.sql` (the `section_variants` and `resume_sections` tables). Migration `0007_subscriptions.sql` is **legacy** — paid tiers were removed, so that table is unused and can be ignored or dropped.

### 4. Enable Google OAuth (recommended)

- Supabase: **Authentication → Providers → Google → Enable**.
- Create OAuth credentials in the [Google Cloud Console](https://console.cloud.google.com).
- Authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in.

## How to use it

1. **Build your sections.** Go to **Sections** and create at least a Header and an Experience variant. Add more variants whenever you want a different angle.
2. **Compose a resume.** Go to **Builder → New resume**, pick a variant for each section, reorder as needed, and name it. The preview fits it to one page automatically.
3. **Export.** Download a **PDF** for quick sending, or **`.tex`** to compile on Overleaf for an exact Jake-template match.
4. **Track outcomes.** Log applications and interviews, link them to the resume you used, and check **Analytics** to see which composition performs best.

## Project structure

```
finalfinal/
├── app/
│   ├── page.tsx              ← Main app page (renders components/App)
│   ├── login/                ← Sign-in page
│   └── api/
│       ├── resumes/          ← list/create compositions, [id] read/update/delete
│       │   ├── export/       ← render a resume to HTML or .tex
│       │   └── match/        ← JD keyword matcher
│       ├── sections/         ← section-variant CRUD (+ [id])
│       ├── applications/     ← application tracking
│       ├── interviews/       ← interview rounds (+ [id])
│       ├── analytics/        ← callback / response rates
│       └── auth/             ← OAuth callback + signout
├── components/
│   ├── App.tsx               ← Shell: nav, dashboard, applications, analytics, modals
│   ├── Builder.tsx           ← Compose a resume + live preview + export
│   ├── ResumePreview.tsx     ← Client-rendered preview with one-page auto-fit
│   ├── SectionLibrary.tsx    ← Manage section variants
│   ├── SectionEditor.tsx     ← Guided, per-kind structured editors
│   └── VariantEditorModal.tsx
├── lib/
│   ├── sections.ts           ← Section kinds, data shapes, editor field specs
│   ├── resume-render.ts      ← HTML / LaTeX / plain-text renderers
│   ├── compose.ts            ← Composition read/write + content-cache regen
│   ├── api.ts                ← Typed SDK for the frontend
│   ├── api-helpers.ts        ← Zod schemas + route() wrapper
│   ├── keyword-matcher.ts    ← JD keyword extraction/matching
│   ├── supabase-server.ts    ← Server client + auth
│   └── supabase-client.ts    ← Browser client
├── supabase/migrations/      ← Schema + RLS policies (0001–0008)
├── types/database.ts         ← TypeScript types matching the schema
└── middleware.ts             ← Auth session refresh on every request
```

## How it works

### The section model
A **section variant** (`section_variants`) is one version of one section kind, with structured `data` (JSON) whose shape depends on the kind. A **resume** is a row in `resumes` plus an ordered list of variant references in `resume_sections`. The plain-text rendering of a resume is cached on `resumes.content` so keyword matching, search, and analytics work without re-rendering.

### Rendering
`lib/resume-render.ts` turns a composition into three outputs from the *same* structured data:
- **HTML** — a self-contained Jake facsimile with a `scale` knob (drives the preview and PDF).
- **LaTeX** — genuine Jake `.tex` source (`\resumeSubheading`, `\resumeProjectHeading`, `multicols`, proper escaping).
- **Plain text** — the cache used for matching and search.

The preview renders the HTML in the browser, measures the laid-out height, and lowers the font scale until the content fits one page.

### Auth & data flow
1. Sign in via Supabase Auth (Google OAuth).
2. Middleware refreshes the session cookie on each request.
3. API routes validate input with Zod; **Row-Level Security** scopes every query to `auth.uid()`.
4. The frontend calls the typed SDK in `lib/api.ts`, then reloads state.

### Database design
- **section_variants** — `user_id`, `kind`, `label`, `data` (jsonb), timestamps.
- **resume_sections** — `resume_id`, `variant_id`, `position` (the ordered composition).
- **resumes** — `user_id`, `name`, `tags`, `notes`, and a generated `content` text cache.
- **applications** / **interviews** — tracking, linked to resumes / applications.
- **version_stats** view — callback rates computed in SQL.
- **RLS** on every table so users only see their own data.

## API reference

All endpoints return typed JSON and require a valid session cookie.

### Sections
- `GET /api/sections?kind=experience` → list your section variants (optionally by kind)
- `POST /api/sections` → create (`{ kind, label, data }`)
- `PATCH /api/sections/[id]` → update `label` / `data`
- `DELETE /api/sections/[id]` → delete (cascades out of any composition)

### Resumes
- `GET /api/resumes` → list your resumes
- `POST /api/resumes` → create a composition (`{ name, tags?, notes?, sections: string[] }`)
- `GET /api/resumes/[id]` → resume + hydrated section variants + linked applications
- `PATCH /api/resumes/[id]` → update metadata and/or composition
- `DELETE /api/resumes/[id]` → delete
- `GET /api/resumes/export?id=...&format=html|tex&scale=1` → render to HTML or LaTeX
- `POST /api/resumes/match` → JD keyword match (`{ job_text, resume_id? | resume_text? }`)

### Applications
- `GET /api/applications` → list (filters: `?status=&resume_id=&search=`)
- `POST /api/applications` → create
- `PATCH /api/applications/[id]` / `DELETE /api/applications/[id]`

### Interviews
- `GET /api/interviews?application_id=...` → list
- `POST /api/interviews` → create
- `PATCH /api/interviews/[id]` / `DELETE /api/interviews/[id]`

### Analytics
- `GET /api/analytics` → overall callback rates + per-resume breakdown

## Roadmap

- **File import** — Drag a PDF/DOCX/TEX and auto-split it into section variants.
- **AI bullet assist** — Suggest stronger, metric-driven bullet rewrites.
- **ATS score** — Estimate match quality against a pasted job description.
- **Shareable previews** — Read-only links to a composed resume.

## Contributing

Active learning project — issues and PRs welcome.

## License
MIT 
