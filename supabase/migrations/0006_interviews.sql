-- ============================================================
-- FinalFinal — interviews
-- ============================================================
-- One row per interview. Each interview is linked to an
-- application, so a single application can have several
-- (phone screen → technical → onsite → final).
-- ============================================================

create table if not exists public.interviews (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  application_id  uuid not null references public.applications(id) on delete cascade,
  scheduled_at    timestamptz,
  kind            text check (kind is null or char_length(kind) between 1 and 40),
  notes           text not null default '',
  outcome         text check (outcome is null or outcome in ('pending', 'passed', 'rejected', 'withdrew')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.interviews is
  'Interviews attached to an application — phone screen, onsite, etc.';

create index if not exists interviews_app_idx
  on public.interviews (application_id, scheduled_at);

create index if not exists interviews_user_scheduled_idx
  on public.interviews (user_id, scheduled_at desc);

-- updated_at trigger
drop trigger if exists interviews_set_updated_at on public.interviews;
create trigger interviews_set_updated_at
  before update on public.interviews
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.interviews enable row level security;

drop policy if exists "interviews: select own" on public.interviews;
create policy "interviews: select own"
  on public.interviews
  for select
  using (auth.uid() = user_id);

drop policy if exists "interviews: insert own" on public.interviews;
create policy "interviews: insert own"
  on public.interviews
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.user_id = auth.uid()
    )
  );

drop policy if exists "interviews: update own" on public.interviews;
create policy "interviews: update own"
  on public.interviews
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "interviews: delete own" on public.interviews;
create policy "interviews: delete own"
  on public.interviews
  for delete
  using (auth.uid() = user_id);
