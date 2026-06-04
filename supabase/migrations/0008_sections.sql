-- ============================================================
-- FinalFinal — section-based resume model
-- ============================================================
-- The redesign: a resume is no longer a blob of free text. It is
-- COMPOSED from reusable, versioned section blocks ("variants").
--
--   section_variants  — one row per variant of a section kind.
--                       e.g. two "experience" variants: a quant-
--                       focused one and a full-stack one. This is
--                       the mix-and-match library. Branching now
--                       lives here, per section.
--
--   resume_sections   — join table: which variants make up a given
--                       resume, and in what order.
--
-- `public.resumes` is repurposed as the composition (the tailored
-- resume an application links to). Its `content` column is kept as
-- a GENERATED CACHE of the rendered plain text, so keyword-match,
-- analytics, and .txt export keep working unchanged. `parent_id`
-- is no longer used (branching moved to section_variants) but the
-- column stays to avoid disturbing the applications FK / RLS.
-- ============================================================


-- ------------------------------------------------------------
-- 1. section kinds
-- ------------------------------------------------------------
do $$ begin
  create type public.section_kind as enum (
    'header',
    'education',
    'coursework',
    'experience',
    'projects',
    'skills',
    'leadership'
  );
exception
  when duplicate_object then null;
end $$;


-- ------------------------------------------------------------
-- 2. section_variants
-- ------------------------------------------------------------
-- A single variant of a single section. `data` holds the
-- structured content; its shape depends on `kind` (validated in
-- the API layer / TypeScript, not in SQL, so the schema can
-- evolve without a migration).
-- ------------------------------------------------------------
create table if not exists public.section_variants (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        public.section_kind not null,
  label       text not null check (char_length(label) between 1 and 120),
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.section_variants is
  'Reusable, versioned section blocks. Branching lives here, per section.';

-- "show me all my variants of kind X" → filter by user_id, kind
create index if not exists section_variants_user_kind_idx
  on public.section_variants (user_id, kind, created_at desc);


-- ------------------------------------------------------------
-- 3. resume_sections (composition)
-- ------------------------------------------------------------
-- Which variants make up a resume, ordered by `position`. Deleting
-- a variant cascades the row out of every composition that used it;
-- the API re-normalizes positions afterward.
-- ------------------------------------------------------------
create table if not exists public.resume_sections (
  id          uuid primary key default gen_random_uuid(),
  resume_id   uuid not null references public.resumes(id) on delete cascade,
  variant_id  uuid not null references public.section_variants(id) on delete cascade,
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.resume_sections is
  'Ordered list of section variants that compose a resume.';

create index if not exists resume_sections_resume_idx
  on public.resume_sections (resume_id, position);
create index if not exists resume_sections_variant_idx
  on public.resume_sections (variant_id);


-- ------------------------------------------------------------
-- 4. updated_at trigger for section_variants
-- ------------------------------------------------------------
drop trigger if exists section_variants_set_updated_at on public.section_variants;
create trigger section_variants_set_updated_at
  before update on public.section_variants
  for each row execute function public.set_updated_at();


-- ============================================================
-- 5. RLS
-- ============================================================
alter table public.section_variants enable row level security;
alter table public.resume_sections   enable row level security;

-- ---- section_variants: owner-only -------------------------
drop policy if exists "section_variants: select own" on public.section_variants;
create policy "section_variants: select own"
  on public.section_variants for select
  using (auth.uid() = user_id);

drop policy if exists "section_variants: insert own" on public.section_variants;
create policy "section_variants: insert own"
  on public.section_variants for insert
  with check (auth.uid() = user_id);

drop policy if exists "section_variants: update own" on public.section_variants;
create policy "section_variants: update own"
  on public.section_variants for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "section_variants: delete own" on public.section_variants;
create policy "section_variants: delete own"
  on public.section_variants for delete
  using (auth.uid() = user_id);

-- ---- resume_sections: governed by the parent resume -------
-- A row is yours if you own the resume it belongs to (and, on
-- write, the variant being attached).
drop policy if exists "resume_sections: select own" on public.resume_sections;
create policy "resume_sections: select own"
  on public.resume_sections for select
  using (
    exists (select 1 from public.resumes r
            where r.id = resume_id and r.user_id = auth.uid())
  );

drop policy if exists "resume_sections: insert own" on public.resume_sections;
create policy "resume_sections: insert own"
  on public.resume_sections for insert
  with check (
    exists (select 1 from public.resumes r
            where r.id = resume_id and r.user_id = auth.uid())
    and exists (select 1 from public.section_variants v
                where v.id = variant_id and v.user_id = auth.uid())
  );

drop policy if exists "resume_sections: update own" on public.resume_sections;
create policy "resume_sections: update own"
  on public.resume_sections for update
  using (
    exists (select 1 from public.resumes r
            where r.id = resume_id and r.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.resumes r
            where r.id = resume_id and r.user_id = auth.uid())
  );

drop policy if exists "resume_sections: delete own" on public.resume_sections;
create policy "resume_sections: delete own"
  on public.resume_sections for delete
  using (
    exists (select 1 from public.resumes r
            where r.id = resume_id and r.user_id = auth.uid())
  );
