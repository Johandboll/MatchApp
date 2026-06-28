create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  privacy_notice_version text,
  privacy_notice_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists privacy_notice_version text,
  add column if not exists privacy_notice_seen_at timestamptz;

alter table public.profiles enable row level security;

drop policy if exists "users can read their own profile" on public.profiles;
drop policy if exists "users can update their own profile" on public.profiles;
drop policy if exists "users can insert their own profile" on public.profiles;

create policy "users can read their own profile"
on public.profiles for select
to authenticated
using (user_id = (select auth.uid()));

create policy "users can update their own profile"
on public.profiles for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "users can insert their own profile"
on public.profiles for insert
to authenticated
with check (user_id = (select auth.uid()));

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (user_id, display_name, email)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), ''),
    new.email
  )
  on conflict (user_id) do update
  set email = excluded.email,
      display_name = coalesce(public.profiles.display_name, excluded.display_name),
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

insert into public.profiles (user_id, display_name, email)
select
  au.id,
  nullif(trim(coalesce(au.raw_user_meta_data->>'display_name', '')), ''),
  au.email
from auth.users au
on conflict (user_id) do update
set email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    updated_at = now();
