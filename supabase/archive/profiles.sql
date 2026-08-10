create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  privacy_notice_version text,
  privacy_notice_seen_at timestamptz,
  account_status text not null default 'pending',
  team_create_limit integer not null default 0,
  is_system_admin boolean not null default false,
  club_name text,
  organization_role text,
  requested_team_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists privacy_notice_version text,
  add column if not exists privacy_notice_seen_at timestamptz,
  add column if not exists account_status text not null default 'pending',
  add column if not exists team_create_limit integer not null default 0,
  add column if not exists is_system_admin boolean not null default false,
  add column if not exists club_name text,
  add column if not exists organization_role text,
  add column if not exists requested_team_name text;

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
  insert into public.profiles (
    user_id,
    display_name,
    email,
    club_name,
    organization_role,
    requested_team_name
  )
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), ''),
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data->>'club_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'organization_role', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'requested_team_name', '')), '')
  )
  on conflict (user_id) do update
  set email = excluded.email,
      display_name = coalesce(public.profiles.display_name, excluded.display_name),
      club_name = coalesce(public.profiles.club_name, excluded.club_name),
      organization_role = coalesce(public.profiles.organization_role, excluded.organization_role),
      requested_team_name = coalesce(public.profiles.requested_team_name, excluded.requested_team_name),
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

insert into public.profiles (
  user_id,
  display_name,
  email,
  club_name,
  organization_role,
  requested_team_name
)
select
  au.id,
  nullif(trim(coalesce(au.raw_user_meta_data->>'display_name', '')), ''),
  au.email,
  nullif(trim(coalesce(au.raw_user_meta_data->>'club_name', '')), ''),
  nullif(trim(coalesce(au.raw_user_meta_data->>'organization_role', '')), ''),
  nullif(trim(coalesce(au.raw_user_meta_data->>'requested_team_name', '')), '')
from auth.users au
on conflict (user_id) do update
set email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    club_name = coalesce(public.profiles.club_name, excluded.club_name),
    organization_role = coalesce(public.profiles.organization_role, excluded.organization_role),
    requested_team_name = coalesce(public.profiles.requested_team_name, excluded.requested_team_name),
    updated_at = now();
