-- ============================================================
-- Fix: UPDATE policies must re-check foreign-key ownership
-- ============================================================
-- The INSERT policies (0003, 0005, 0006, 0008) verify that any
-- resume / application / variant a row points at belongs to the
-- caller. The matching UPDATE policies only re-checked user_id,
-- so a user could insert a row legitimately and then re-point it
-- at another user's resume_id / application_id / variant_id /
-- parent_id. Caught by tests/db/rls.test.ts.
--
-- Purely restrictive: every legitimate app flow already links
-- only to the caller's own rows.
-- ============================================================

drop policy if exists "applications: update own" on public.applications;
create policy "applications: update own"
  on public.applications
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      resume_id is null
      or exists (
        select 1 from public.resumes r
        where r.id = resume_id and r.user_id = auth.uid()
      )
    )
  );

drop policy if exists "interviews: update own" on public.interviews;
create policy "interviews: update own"
  on public.interviews
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.user_id = auth.uid()
    )
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
    and exists (select 1 from public.section_variants v
                where v.id = variant_id and v.user_id = auth.uid())
  );

-- `parent_id in (select id ...)` rather than EXISTS — see 0005 for why an
-- unqualified parent_id inside a subquery on resumes resolves to the wrong row.
drop policy if exists "resumes: update own" on public.resumes;
create policy "resumes: update own"
  on public.resumes
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      parent_id is null
      or parent_id in (
        select id from public.resumes where user_id = auth.uid()
      )
    )
  );
