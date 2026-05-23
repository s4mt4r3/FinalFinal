-- ============================================================
-- FinalFinal — Row Level Security (RLS) policies
-- ============================================================
-- THIS IS THE MOST IMPORTANT FILE IN THE BACKEND.
--
-- Without RLS, anyone with your Supabase anon key could run
--   `select * from resumes`
-- and read every user's resumes. With RLS enabled, Postgres
-- silently filters every query so users only see their own rows.
--
-- The pattern: `auth.uid()` returns the currently logged-in user's
-- UUID (Supabase injects this from the JWT). We compare it to
-- the row's user_id.
-- ============================================================


-- ------------------------------------------------------------
-- Enable RLS on every table
-- ------------------------------------------------------------
-- Once enabled, ALL access is denied by default. Policies grant
-- specific permissions back. If you forget a policy, the table
-- becomes invisible — which is the safe default.
-- ------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.resumes       enable row level security;
alter table public.applications  enable row level security;


-- ============================================================
-- profiles policies
-- ============================================================
-- Users can read and update their own profile only.
-- Inserts happen via the auth trigger, so no insert policy needed
-- for normal app flow (the trigger uses security definer to bypass).
-- ============================================================

drop policy if exists "profiles: select own" on public.profiles;
create policy "profiles: select own"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- ============================================================
-- resumes policies
-- ============================================================

drop policy if exists "resumes: select own" on public.resumes;
create policy "resumes: select own"
  on public.resumes
  for select
  using (auth.uid() = user_id);

drop policy if exists "resumes: insert own" on public.resumes;
create policy "resumes: insert own"
  on public.resumes
  for insert
  with check (
    auth.uid() = user_id
    -- And if a parent is specified, you must own the parent too.
    -- This prevents grafting your resume onto someone else's tree.
    --
    -- NOTE: `parent_id in (select id ...)` (not `exists`). Inside an
    -- EXISTS subquery on `public.resumes`, the unqualified `parent_id`
    -- would resolve to the inner row's column (because `resumes` has
    -- its own `parent_id` column) — not the new row being inserted.
    -- Using `parent_id in (select id ...)` keeps the outer reference
    -- unambiguous: the subquery never names `parent_id`.
    and (
      parent_id is null
      or parent_id in (
        select id from public.resumes where user_id = auth.uid()
      )
    )
  );

drop policy if exists "resumes: update own" on public.resumes;
create policy "resumes: update own"
  on public.resumes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "resumes: delete own" on public.resumes;
create policy "resumes: delete own"
  on public.resumes
  for delete
  using (auth.uid() = user_id);


-- ============================================================
-- applications policies
-- ============================================================

drop policy if exists "applications: select own" on public.applications;
create policy "applications: select own"
  on public.applications
  for select
  using (auth.uid() = user_id);

drop policy if exists "applications: insert own" on public.applications;
create policy "applications: insert own"
  on public.applications
  for insert
  with check (
    auth.uid() = user_id
    -- If linking to a resume, you must own it.
    and (
      resume_id is null
      or exists (
        select 1 from public.resumes r
        where r.id = resume_id and r.user_id = auth.uid()
      )
    )
  );

drop policy if exists "applications: update own" on public.applications;
create policy "applications: update own"
  on public.applications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "applications: delete own" on public.applications;
create policy "applications: delete own"
  on public.applications
  for delete
  using (auth.uid() = user_id);


-- ============================================================
-- Storage policies (for raw resume file uploads)
-- ============================================================
-- We'll store uploaded PDFs/DOCX/TEX in a private bucket called
-- 'resume-files'. Files are organized as `{user_id}/{uuid}.pdf`,
-- so we just check the first folder of the path matches auth.uid().
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('resume-files', 'resume-files', false)
  on conflict (id) do nothing;

drop policy if exists "resume files: select own" on storage.objects;
create policy "resume files: select own"
  on storage.objects
  for select
  using (
    bucket_id = 'resume-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "resume files: insert own" on storage.objects;
create policy "resume files: insert own"
  on storage.objects
  for insert
  with check (
    bucket_id = 'resume-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "resume files: delete own" on storage.objects;
create policy "resume files: delete own"
  on storage.objects
  for delete
  using (
    bucket_id = 'resume-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
