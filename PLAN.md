# FinalFinal — Resume Version Control

## What this is
A resume version control app. Students upload resume versions,
branch them like Git, diff them side by side, and track which
version got callbacks.

## Stack
- Next.js 15 (App Router, TypeScript)
- Supabase (Postgres + Auth + Storage)
- Tailwind CSS
- Deployed on Vercel

## Current state
[X] Supabase schema migrated (all 4 migrations run)
[X] Auth working (Google OAuth + login page)
[X] MVP artifact ported to app/page.tsx
[X] window.storage swapped for api.* calls
[ ] File upload (PDF/DOCX/TEX → plain text)
[ ] Loading states + error handling
[ ] Deployed to Vercel

## Key files
- app/page.tsx       → the full React UI (still uses window.storage)
- lib/api.ts         → typed SDK the UI calls (ready but unused)
- app/api/**         → backend route handlers (built, not wired)
- lib/api-helpers.ts → zod validation + route() wrapper
- supabase/migrations/ → full database schema + RLS
- types/database.ts  → TypeScript types

## Next immediate task
Swap window.storage for real API calls in app/page.tsx.
This is the biggest code change but is a perfect Claude Code task.

## Claude Code workflow
See section below.