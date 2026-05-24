-- ============================================================
-- FinalFinal — subscriptions
-- ============================================================
-- One row per user, tracking their Stripe subscription. The
-- Stripe webhook is the only thing that writes to this table
-- (via the service_role); users can read their own row.
-- ============================================================

create type public.subscription_status as enum (
  'active', 'trialing', 'past_due', 'canceled', 'incomplete'
);

create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique references auth.users(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  tier                   text not null default 'free' check (tier in ('free', 'plus')),
  status                 public.subscription_status not null default 'incomplete',
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.subscriptions is
  'Per-user billing state mirrored from Stripe by webhook.';

create index if not exists subscriptions_customer_idx
  on public.subscriptions (stripe_customer_id);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS: read-only for the owner. Writes go through service_role
-- in the webhook handler, which bypasses RLS.
-- ------------------------------------------------------------
alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions: select own" on public.subscriptions;
create policy "subscriptions: select own"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);
