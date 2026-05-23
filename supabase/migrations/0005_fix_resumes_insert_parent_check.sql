-- ============================================================
-- Fix: resumes INSERT policy — column-scoping bug
-- ============================================================
-- The original policy (in 0003) used:
--
--   exists (
--     select 1 from public.resumes
--     where p.id = parent_id and p.user_id = auth.uid()
--   )
--
-- Inside that subquery, `public.resumes` is aliased `p`, which
-- has its own `parent_id` column. By Postgres scoping rules, the
-- unqualified `parent_id` resolves to `p.parent_id` — the inner
-- row's column — NOT the new row being inserted. So the check
-- silently became `p.id = p.parent_id` (find a row that is its
-- own parent), which is essentially never true. Every branch
-- insert was rejected with "row violates row-level security
-- policy for table 'resumes'".
--
-- The fix: rewrite using `IN (SELECT id ...)`. The subquery
-- doesn't reference `parent_id` itself, so the outer reference
-- resolves unambiguously to the new row's column.
-- ============================================================

drop policy if exists "resumes: insert own" on public.resumes;
create policy "resumes: insert own"
  on public.resumes
  for insert
  with check (
    auth.uid() = user_id
    and (
      parent_id is null
      or parent_id in (
        select id from public.resumes where user_id = auth.uid()
      )
    )
  );
