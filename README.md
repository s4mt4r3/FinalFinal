# FinalFinal — Resume Version Control

A modern resume version control system for students and job seekers. Track every iteration of your resume, branch versions for different roles or companies, and see which versions get callbacks.

## Concept

Writing a resume is iterative. You tweak bullets for different companies, add metrics after feedback, optimize for ATS keywords. **FinalFinal** treats your resume like a Git repository:

- **Master resume** is your source of truth
- **Branches** are role-specific or company-specific versions (e.g., "SWE — Google", "Quant Finance")
- **Commits** are saved versions with timestamps and notes
- **Diffs** show you what changed between versions
- **Analytics** reveal which versions get callbacks—so you can see what's working

Track applications alongside versions. Link each application to a resume version so you know exactly which iteration got you that interview.

## Features

### Resume Management
- **Version tree** — Create, branch, and organize unlimited resume versions
- **Side-by-side diff** — See exactly what changed between any two versions
- **Tagging** — Label versions by role, company, or target audience (e.g. `#swe #google`)
- **Notes** — Attach context to each version (e.g. "Career center feedback: add metrics")
- **Export** — Download any version as plain text

### Application Tracking
- **Track every application** — Company, role, status (applied/interviewing/offer/rejected/ghosted)
- **Link to resume versions** — Know which version you used for each application
- **Search & filter** — Find applications by status, company, or resume
- **Timeline view** — See your application history in one place

### Analytics
- **Callback rates per version** — Which resumes get the most interviews?
- **Response rate tracking** — Overall stats and version-by-version breakdown
- **Identify patterns** — Find correlations between resume changes and interview rates

## Tech Stack

- **Frontend**: Next.js 15 (App Router, React 19, TypeScript)
- **Styling**: Tailwind CSS + custom design system (paper/terracotta palette, Fraunces serif font)
- **Backend**: Next.js API routes with Zod validation
- **Database**: Supabase (PostgreSQL) with Row-Level Security
- **Auth**: Supabase Auth + Google OAuth
- **Deployment**: Vercel (recommended)

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/s4mt4r3/FinalFinal.git
cd FinalFinal
npm install
```

### 2. Set up Supabase

1. Create a free Supabase project at [supabase.com](https://supabase.com)
2. Go to **Settings → API** and copy your **Project URL** and **anon key**
3. Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run Migrations

In the Supabase dashboard, go to **SQL Editor** and run each file in `supabase/migrations/` in order (0001, 0002, 0003, 0004).

### 4. Enable Google OAuth (Optional but Recommended)

- In Supabase: **Authentication → Providers → Google → Enable**
- Get a Client ID from [Google Cloud Console](https://console.cloud.google.com)
- Authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`
- Paste credentials into Supabase

### 5. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with Google.

## Project Structure

```
finalfinal/
├── app/
│   ├── (layout)           ← Auth check, root HTML
│   ├── page.tsx           ← Main app page (imports from components/App)
│   ├── login/             ← Sign-in page
│   └── api/
│       ├── resumes/       ← GET list, POST create, PATCH update, DELETE
│       ├── applications/  ← GET list, POST create, PATCH update, DELETE
│       ├── analytics/     ← GET callback rates
│       └── auth/
│           ├── callback/  ← OAuth redirect handler
│           └── signout/   ← Logout endpoint
├── components/
│   └── App.tsx            ← Full React UI (all views and modals)
├── lib/
│   ├── api.ts             ← Typed SDK for frontend
│   ├── api-helpers.ts     ← Zod schemas + route() wrapper
│   ├── supabase-server.ts ← Server-side client + auth
│   └── supabase-client.ts ← Browser-side client
├── supabase/migrations/   ← Database schema + RLS policies
├── types/database.ts      ← TypeScript types matching schema
├── middleware.ts          ← Auth session refresh on every request
└── PLAN.md               ← (ignored by git) Session notes
```

## How It Works

### Authentication Flow
1. User clicks "Sign in with Google"
2. Redirected to Supabase Auth → Google
3. Returns to `/api/auth/callback?code=...`
4. Exchange code for session cookie
5. Redirected to dashboard or protected route
6. Middleware refreshes cookie on each request (keeps 1hr sessions alive)
7. All API calls scoped to `auth.uid()` via RLS

### Data Flow
1. React component calls `api.resumes.create({ name, content, ... })`
2. Fetch POST `/api/resumes` with JSON body
3. Middleware runs (refreshes auth)
4. Route handler validates with Zod
5. RLS policy checks `user_id = auth.uid()`
6. Postgres inserts row
7. API returns typed Resume object
8. Component reloads data from Supabase
9. UI updates with fresh state

### Database Design
- **Resumes**: user_id, parent_id (for branching), name, content, tags, notes, timestamps
- **Applications**: user_id, resume_id, company, role, status, date_applied, notes
- **Profiles**: User metadata synced from auth.users
- **RLS**: Every table filtered by `auth.uid()` so users only see their own data
- **Analytics view**: `version_stats` computes callback rates in SQL

## API Reference

All endpoints return typed JSON. Requires valid session cookie.

### Resumes
- `GET /api/resumes` → List your resumes
- `POST /api/resumes` → Create (body: `{ name, content?, parent_id?, tags?, notes? }`)
- `GET /api/resumes/[id]` → Get one + children + linked applications
- `PATCH /api/resumes/[id]` → Update fields
- `DELETE /api/resumes/[id]` → Delete

### Applications
- `GET /api/applications` → List your applications (optional filters: `?status=offer&resume_id=...&search=...`)
- `POST /api/applications` → Create (body: `{ company, role?, resume_id?, status?, notes?, date_applied? }`)
- `PATCH /api/applications/[id]` → Update fields
- `DELETE /api/applications/[id]` → Delete

### Analytics
- `GET /api/analytics` → Overall callback rates + per-version breakdown

## Future Features

- **File upload** — Drag & drop PDF/DOCX/TEX → auto-extract text and create resume
- **Shareable diffs** — Generate unique links to compare versions with others
- **Resume templates** — Start from a curated template instead of blank slate
- **ATS scoring** — Estimate how well your resume matches job descriptions
- **Interview tracking** — Track interview rounds, feedback, and offers per application
- **Rate limiting** — For public launch

## Contributing

This is an active learning project. Issues and PRs welcome!

## License

MIT
