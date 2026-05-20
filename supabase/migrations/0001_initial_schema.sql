-- ============================================================
-- FinalFinal — initial schema
-- ============================================================
-- Run this in Supabase SQL Editor (or `supabase db push`).
-- Supabase already provides an `auth.users` table managed by
-- Supabase Auth. We don't recreate it — we just reference it.
--
-- Three tables we own:
--   profiles      — public mirror of auth.users (display name, etc.)
--   resumes       — every resume version (a node in the version tree)
--   applications  — job applications, each linked to a resume version
-- ============================================================


-- ------------------------------------------------------------
-- 1. profiles
-- ------------------------------------------------------------
-- One row per signed-up user. The `id` matches auth.users.id.
-- We auto-populate this with a trigger when a new user signs up
-- (see migration 0002).
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  display_name text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Public profile data, one row per auth user.';


-- ------------------------------------------------------------
-- 2. resumes
-- ------------------------------------------------------------
-- A single version of a resume. parent_id makes this a tree:
-- null parent = root; otherwise it's a branch of another version.
-- ------------------------------------------------------------
create table if not exists public.resumes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  parent_id   uuid references public.resumes(id) on delete set null,
  name        text not null check (char_length(name) between 1 and 200),
  content     text not null default '',
  tags        text[] not null default '{}',
  notes       text not null default '',
  -- Optional: link to a raw uploaded file in Supabase Storage
  source_file_path text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.resumes is 'A single resume version. parent_id forms the version tree.';

-- Indexes for the queries we'll run most:
-- a) "show me all my resumes" → filter by user_id, sort by created_at
create index if not exists resumes_user_created_idx
  on public.resumes (user_id, created_at desc);

-- b) "show me children of this version" → filter by parent_id
create index if not exists resumes_parent_idx
  on public.resumes (parent_id);


-- ------------------------------------------------------------
-- 3. applications
-- ------------------------------------------------------------
-- One row per tracked job application. Linked to a resume version
-- (the one you submitted) so analytics can correlate.
-- ------------------------------------------------------------
create type public.application_status as enum (
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'ghosted'
);

create table if not exists public.applications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- If the resume is deleted, we keep the application but null out the link.
  -- This preserves historical data (you applied to Google, even if you later
  -- deleted that resume version).
  resume_id     uuid references public.resumes(id) on delete set null,
  company       text not null check (char_length(company) between 1 and 200),
  role          text,
  status        public.application_status not null default 'applied',
  notes         text not null default '',
  date_applied  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.applications is 'Job applications, each linked to a resume version.';

create index if not exists applications_user_date_idx
  on public.applications (user_id, date_applied desc);

create index if not exists applications_resume_idx
  on public.applications (resume_id);


-- ------------------------------------------------------------
-- 4. updated_at triggers
-- ------------------------------------------------------------
-- Auto-update the updated_at column on every UPDATE.
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists resumes_set_updated_at on public.resumes;
create trigger resumes_set_updated_at
  before update on public.resumes
  for each row execute function public.set_updated_at();

drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();
