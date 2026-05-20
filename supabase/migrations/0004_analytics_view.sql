-- ============================================================
-- FinalFinal — analytics view
-- ============================================================
-- A SQL view that pre-computes callback rates per resume version.
-- Your /api/analytics endpoint just selects from this instead of
-- doing the math in TypeScript every time.
--
-- A view is a saved query — it doesn't store data, it re-runs
-- the underlying SQL each time you read from it.
-- ============================================================

create or replace view public.version_stats as
select
  r.id              as resume_id,
  r.user_id         as user_id,
  r.name            as resume_name,
  count(a.id)                                                    as applied,
  count(*) filter (where a.status in ('interviewing', 'offer'))  as callbacks,
  count(*) filter (where a.status = 'offer')                     as offers,
  count(*) filter (where a.status = 'rejected')                  as rejected,
  count(*) filter (where a.status = 'ghosted')                   as ghosted,
  case
    when count(a.id) > 0
    then round(
      (count(*) filter (where a.status in ('interviewing', 'offer'))::numeric
        / count(a.id)) * 100,
      1
    )
    else 0
  end as callback_rate_pct
from public.resumes r
left join public.applications a on a.resume_id = r.id
group by r.id, r.user_id, r.name;

-- Views inherit RLS from their underlying tables by default in
-- Postgres 15+, but to be explicit we tell it to honor the
-- querying user's permissions:
alter view public.version_stats set (security_invoker = true);

comment on view public.version_stats is
  'Per-resume callback rate analytics, filtered by RLS to current user.';
