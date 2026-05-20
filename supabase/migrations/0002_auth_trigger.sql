-- ============================================================
-- FinalFinal — auto-create profile on signup
-- ============================================================
-- When a new user signs up via Supabase Auth, automatically
-- create a matching row in public.profiles. This way you never
-- have to call "create profile" manually from your app.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer  -- runs with the function owner's privileges
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
