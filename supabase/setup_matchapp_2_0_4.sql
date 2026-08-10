-- MatchApp 2.0.4 fresh Supabase setup
-- Kör i ett tomt Supabase-projekt, till exempel matchapp-test.
-- Seed-filer med skarpa användar-id ingår inte.
--


-- ============================================================
-- supabase/matchapp_schema.sql
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_at timestamptz not null default now()
);

alter table public.teams
  add column if not exists deletion_scheduled_at timestamptz,
  add column if not exists deletion_scheduled_by uuid references auth.users(id) on delete set null;

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  shirt_number numeric not null,
  name text not null,
  role text not null default 'field' check (role in ('field', 'goalkeeper')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (team_id, name)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  match_info jsonb not null default '{}'::jsonb,
  match_type text not null default 'series' check (match_type in ('series', 'cup')),
  cup_name text not null default '',
  cup_phase text not null default '',
  result jsonb not null default '{}'::jsonb,
  selected_players jsonb not null default '[]'::jsonb,
  player_roster jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;

create or replace function public.is_team_member(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = target_team_id
      and tm.user_id = auth.uid()
  );
$$;

create or replace function public.is_team_admin(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = target_team_id
      and tm.user_id = auth.uid()
      and tm.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_team_owner(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = target_team_id
      and tm.user_id = auth.uid()
      and tm.role = 'owner'
  );
$$;

-- Keep the setup safe to rerun in an existing test project.
drop policy if exists "members can read their teams" on public.teams;
drop policy if exists "users can read their own team memberships" on public.team_members;
drop policy if exists "admins can insert team memberships" on public.team_members;
drop policy if exists "admins can update team memberships" on public.team_members;
drop policy if exists "admins can delete team memberships" on public.team_members;
drop policy if exists "members can read players" on public.players;
drop policy if exists "admins can insert players" on public.players;
drop policy if exists "admins can update players" on public.players;
drop policy if exists "admins can delete players" on public.players;
drop policy if exists "members can read matches" on public.matches;
drop policy if exists "members can create matches" on public.matches;
drop policy if exists "members can update matches" on public.matches;
drop policy if exists "admins can delete matches" on public.matches;

create policy "members can read their teams"
on public.teams for select
to authenticated
using (public.is_team_member(id));

create policy "users can read their own team memberships"
on public.team_members for select
to authenticated
using (user_id = (select auth.uid()));

create policy "admins can insert team memberships"
on public.team_members for insert
to authenticated
with check (public.is_team_admin(team_id) and role <> 'owner');

create policy "admins can update team memberships"
on public.team_members for update
to authenticated
using (public.is_team_owner(team_id))
with check (public.is_team_owner(team_id));

create policy "admins can delete team memberships"
on public.team_members for delete
to authenticated
using (public.is_team_owner(team_id));

create policy "members can read players"
on public.players for select
to authenticated
using (public.is_team_member(team_id));

create policy "admins can insert players"
on public.players for insert
to authenticated
with check (public.is_team_admin(team_id));

create policy "admins can update players"
on public.players for update
to authenticated
using (public.is_team_admin(team_id))
with check (public.is_team_admin(team_id));

create policy "admins can delete players"
on public.players for delete
to authenticated
using (public.is_team_owner(team_id));

create policy "members can read matches"
on public.matches for select
to authenticated
using (public.is_team_member(team_id));

create policy "members can create matches"
on public.matches for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and public.is_team_member(team_id)
);

create policy "members can update matches"
on public.matches for update
to authenticated
using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

create policy "admins can delete matches"
on public.matches for delete
to authenticated
using (public.is_team_owner(team_id));

-- ============================================================
-- supabase/profiles.sql
-- ============================================================

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

-- ============================================================
-- supabase/system_admin_access.sql
-- ============================================================

alter table public.profiles
  add column if not exists account_status text not null default 'pending',
  add column if not exists team_create_limit integer not null default 0,
  add column if not exists is_system_admin boolean not null default false,
  add column if not exists club_name text,
  add column if not exists organization_role text,
  add column if not exists requested_team_name text;

alter table public.profiles
  drop constraint if exists profiles_account_status_check;

alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('pending', 'approved', 'blocked'));

alter table public.profiles
  drop constraint if exists profiles_team_create_limit_check;

alter table public.profiles
  add constraint profiles_team_create_limit_check
  check (team_create_limit >= 0);

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

create or replace function public.is_system_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.is_system_admin = true
      and p.account_status = 'approved'
  );
$$;

create or replace function public.protect_profile_access_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.is_system_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.account_status := 'pending';
    new.team_create_limit := 0;
    new.is_system_admin := false;
    return new;
  end if;

  new.account_status := old.account_status;
  new.team_create_limit := old.team_create_limit;
  new.is_system_admin := old.is_system_admin;
  return new;
end;
$$;

drop trigger if exists protect_profile_access_fields on public.profiles;

create trigger protect_profile_access_fields
before insert or update on public.profiles
for each row execute function public.protect_profile_access_fields();

revoke execute on function public.protect_profile_access_fields() from public, anon, authenticated;

create or replace function public.get_created_team_count(target_user_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer
  from public.team_members tm
  where tm.user_id = target_user_id
    and tm.role = 'owner';
$$;

drop function if exists public.get_my_account_access();

create or replace function public.get_my_account_access()
returns table (
  account_status text,
  team_create_limit integer,
  created_team_count integer,
  pending_account_count integer,
  is_system_admin boolean,
  can_create_team boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(p.account_status, 'pending') as account_status,
    coalesce(p.team_create_limit, 0) as team_create_limit,
    public.get_created_team_count(auth.uid()) as created_team_count,
    case
      when coalesce(p.is_system_admin, false) and coalesce(p.account_status, 'pending') = 'approved'
        then (
          select count(*)::integer
          from public.profiles pending_profiles
          where pending_profiles.account_status = 'pending'
        )
      else 0
    end as pending_account_count,
    coalesce(p.is_system_admin, false) as is_system_admin,
    coalesce(p.account_status, 'pending') = 'approved'
      and public.get_created_team_count(auth.uid()) < coalesce(p.team_create_limit, 0) as can_create_team
  from public.profiles p
  where p.user_id = auth.uid();
$$;

drop function if exists public.list_system_users();

create or replace function public.list_system_users()
returns table (
  user_id uuid,
  display_name text,
  email text,
  club_name text,
  organization_role text,
  requested_team_name text,
  account_status text,
  team_create_limit integer,
  is_system_admin boolean,
  created_team_count integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_system_admin() then
    raise exception 'Endast systemadmin kan se användaråtkomst.';
  end if;

  return query
  select
    au.id,
    p.display_name,
    coalesce(p.email, au.email),
    p.club_name,
    p.organization_role,
    p.requested_team_name,
    coalesce(p.account_status, 'pending'),
    coalesce(p.team_create_limit, 0),
    coalesce(p.is_system_admin, false),
    public.get_created_team_count(au.id),
    au.created_at
  from auth.users au
  left join public.profiles p on p.user_id = au.id
  order by
    case coalesce(p.account_status, 'pending')
      when 'pending' then 1
      when 'approved' then 2
      else 3
    end,
    au.created_at desc;
end;
$$;

create or replace function public.update_system_user_access(
  target_user_id uuid,
  new_account_status text,
  new_team_create_limit integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_system_admin() then
    raise exception 'Endast systemadmin kan ändra användaråtkomst.';
  end if;

  if new_account_status not in ('pending', 'approved', 'blocked') then
    raise exception 'Ogiltig kontostatus.';
  end if;

  if target_user_id = auth.uid() and new_account_status <> 'approved' then
    raise exception 'Du kan inte ändra ditt eget systemadminkonto till väntande eller blockerat.';
  end if;

  if coalesce(new_team_create_limit, 0) < 0 then
    raise exception 'Laggränsen kan inte vara negativ.';
  end if;

  update public.profiles p
  set account_status = new_account_status,
      team_create_limit = coalesce(new_team_create_limit, 0),
      updated_at = now()
  where p.user_id = target_user_id;

  if not found then
    insert into public.profiles (user_id, account_status, team_create_limit)
    values (target_user_id, new_account_status, coalesce(new_team_create_limit, 0));
  end if;
end;
$$;

create or replace function public.slugify_team_name(team_name text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(trim(team_name)), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.create_team_for_current_user(team_name text)
returns table (
  id uuid,
  name text,
  slug text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text;
  base_slug text;
  new_team_id uuid;
  user_access record;
begin
  if auth.uid() is null then
    raise exception 'Du måste vara inloggad för att skapa lag.';
  end if;

  select *
  into user_access
  from public.get_my_account_access();

  if coalesce(user_access.account_status, 'pending') <> 'approved' then
    raise exception 'Kontot måste vara godkänt innan du kan skapa lag.';
  end if;

  if coalesce(user_access.created_team_count, 0) >= coalesce(user_access.team_create_limit, 0) then
    raise exception 'Du har nått din gräns för att skapa lag.';
  end if;

  clean_name := trim(team_name);

  if clean_name = '' then
    raise exception 'Ange ett lagnamn.';
  end if;

  base_slug := public.slugify_team_name(clean_name);

  if base_slug = '' then
    base_slug := 'lag';
  end if;

  if exists (
    select 1
    from public.teams t
    where public.slugify_team_name(t.name) = base_slug
       or t.slug = base_slug
  ) then
    raise exception 'Det finns redan ett lag med det namnet. Be en ägare eller admin i laget lägga till dig istället.';
  end if;

  insert into public.teams (name, slug)
  values (clean_name, base_slug)
  returning teams.id into new_team_id;

  insert into public.team_members (team_id, user_id, role)
  values (new_team_id, auth.uid(), 'owner');

  return query
  select t.id, t.name, t.slug
  from public.teams t
  where t.id = new_team_id;
end;
$$;

drop function if exists public.delete_team_for_current_user(uuid);

create or replace function public.schedule_team_deletion(target_team_id uuid)
returns table (deletion_scheduled_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  scheduled_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Du måste vara inloggad för att schemalägga radering.';
  end if;

  if not public.is_team_owner(target_team_id) then
    raise exception 'Endast lagets ägare kan radera laget.';
  end if;

  scheduled_at := now() + interval '24 hours';

  update public.teams
  set deletion_scheduled_at = scheduled_at,
      deletion_scheduled_by = auth.uid()
  where id = target_team_id;

  if not found then
    raise exception 'Laget kunde inte hittas.';
  end if;

  return query select scheduled_at;
end;
$$;

create or replace function public.cancel_team_deletion(target_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Du måste vara inloggad för att ångra radering.';
  end if;

  if not public.is_team_owner(target_team_id) then
    raise exception 'Endast lagets ägare kan ångra raderingen.';
  end if;

  update public.teams
  set deletion_scheduled_at = null,
      deletion_scheduled_by = null
  where id = target_team_id;

  if not found then
    raise exception 'Laget kunde inte hittas.';
  end if;
end;
$$;

create or replace function public.purge_scheduled_teams()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.teams
  where deletion_scheduled_at is not null
    and deletion_scheduled_at <= now();
$$;

revoke execute on function public.purge_scheduled_teams() from public, anon, authenticated;

create extension if not exists pg_cron with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'matchapp-purge-scheduled-teams';

select cron.schedule(
  'matchapp-purge-scheduled-teams',
  '*/5 * * * *',
  'select public.purge_scheduled_teams();'
);

revoke execute on function public.is_system_admin() from public, anon;
grant execute on function public.is_system_admin() to authenticated;

revoke execute on function public.protect_profile_access_fields() from public, anon, authenticated;

revoke execute on function public.get_created_team_count(uuid) from public, anon;
grant execute on function public.get_created_team_count(uuid) to authenticated;

revoke execute on function public.get_my_account_access() from public, anon;
grant execute on function public.get_my_account_access() to authenticated;

revoke execute on function public.list_system_users() from public, anon;
grant execute on function public.list_system_users() to authenticated;

revoke execute on function public.update_system_user_access(uuid, text, integer) from public, anon;
grant execute on function public.update_system_user_access(uuid, text, integer) to authenticated;

update public.profiles
set account_status = 'approved',
    team_create_limit = greatest(team_create_limit, 10),
    is_system_admin = true,
    updated_at = now()
where user_id = '17096d7f-7124-4fac-a9f5-9107e3b7bda5'::uuid;

-- ============================================================
-- supabase/team_admin_functions.sql
-- ============================================================

drop function if exists public.add_team_member_by_email(uuid, text, text);
drop function if exists public.update_team_member_role(uuid, uuid, text);
drop function if exists public.remove_team_member(uuid, uuid);
drop function if exists public.search_team_member_candidates(uuid, text);
drop function if exists public.list_team_members(uuid);

create or replace function public.list_team_members(target_team_id uuid)
returns table (
  user_id uuid,
  display_name text,
  email text,
  role text,
  created_at timestamptz
)
language sql
security definer
set search_path = public, auth
stable
as $$
  select
    tm.user_id,
    p.display_name::text,
    au.email::text,
    tm.role,
    tm.created_at
  from public.team_members tm
  join auth.users au on au.id = tm.user_id
  left join public.profiles p on p.user_id = tm.user_id
  where tm.team_id = target_team_id
    and public.is_team_member(target_team_id)
  order by
    case tm.role
      when 'owner' then 1
      when 'admin' then 2
      else 3
    end,
    p.display_name,
    au.email;
$$;

create or replace function public.search_team_member_candidates(
  target_team_id uuid,
  search_text text
)
returns table (
  user_id uuid,
  display_name text,
  email text,
  existing_role text
)
language plpgsql
security definer
set search_path = public, auth
stable
as $$
declare
  clean_search text;
begin
  if not public.is_team_admin(target_team_id) then
    raise exception 'Du saknar behörighet att söka efter medlemmar.';
  end if;

  clean_search := lower(trim(coalesce(search_text, '')));

  if length(clean_search) < 2 then
    return;
  end if;

  return query
  select
    au.id,
    p.display_name::text,
    au.email::text,
    tm.role::text as existing_role
  from auth.users au
  left join public.profiles p on p.user_id = au.id
  left join public.team_members tm
    on tm.user_id = au.id
   and tm.team_id = target_team_id
  where lower(coalesce(p.display_name, '')) like '%' || clean_search || '%'
     or lower(coalesce(au.email, '')) like '%' || clean_search || '%'
  order by
    case when tm.user_id is null then 0 else 1 end,
    p.display_name,
    au.email
  limit 8;
end;
$$;

create or replace function public.add_team_member_by_email(
  target_team_id uuid,
  member_email text,
  member_role text default 'member'
)
returns table (
  user_id uuid,
  display_name text,
  email text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user_id uuid;
  clean_email text;
  clean_role text;
  existing_role text;
begin
  if not public.is_team_admin(target_team_id) then
    raise exception 'Du saknar behörighet att lägga till medlemmar i laget.';
  end if;

  clean_email := lower(trim(member_email));
  clean_role := coalesce(nullif(trim(member_role), ''), 'member');

  if clean_role not in ('admin', 'member') then
    raise exception 'Ogiltig roll. Välj admin eller member.';
  end if;

  if clean_role = 'admin' and not public.is_team_owner(target_team_id) then
    raise exception 'Endast ägare kan lägga till en admin.';
  end if;

  select au.id into target_user_id
  from auth.users au
  where lower(au.email) = clean_email
  limit 1;

  if target_user_id is null then
    raise exception 'Det finns inget konto med den e-postadressen ännu.';
  end if;

  select tm.role into existing_role
  from public.team_members tm
  where tm.team_id = target_team_id
    and tm.user_id = target_user_id;

  if existing_role is not null then
    if not public.is_team_owner(target_team_id) then
      raise exception 'Personen finns redan i laget. Endast ägare kan ändra roller.';
    end if;

    update public.team_members tm
    set role = clean_role
    where tm.team_id = target_team_id
      and tm.user_id = target_user_id
      and tm.role <> 'owner';
  else
    insert into public.team_members (team_id, user_id, role)
    values (target_team_id, target_user_id, clean_role);
  end if;

  return query
  select lm.user_id, lm.display_name, lm.email, lm.role, lm.created_at
  from public.list_team_members(target_team_id) lm;
end;
$$;

create or replace function public.update_team_member_role(
  target_team_id uuid,
  target_user_id uuid,
  member_role text
)
returns table (
  user_id uuid,
  display_name text,
  email text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  clean_role text;
begin
  if not public.is_team_owner(target_team_id) then
    raise exception 'Endast ägare kan ändra roller i laget.';
  end if;

  clean_role := coalesce(nullif(trim(member_role), ''), 'member');

  if clean_role not in ('admin', 'member') then
    raise exception 'Ogiltig roll. Välj admin eller member.';
  end if;

  update public.team_members tm
  set role = clean_role
  where tm.team_id = target_team_id
    and tm.user_id = target_user_id
    and tm.role <> 'owner';

  return query
  select lm.user_id, lm.display_name, lm.email, lm.role, lm.created_at
  from public.list_team_members(target_team_id) lm;
end;
$$;

create or replace function public.remove_team_member(
  target_team_id uuid,
  target_user_id uuid
)
returns table (
  user_id uuid,
  display_name text,
  email text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_team_owner(target_team_id) then
    raise exception 'Endast ägare kan ta bort medlemmar i laget.';
  end if;

  delete from public.team_members tm
  where tm.team_id = target_team_id
    and tm.user_id = target_user_id
    and tm.role <> 'owner';

  return query
  select lm.user_id, lm.display_name, lm.email, lm.role, lm.created_at
  from public.list_team_members(target_team_id) lm;
end;
$$;

create unique index if not exists team_members_one_owner_per_team
on public.team_members (team_id)
where role = 'owner';

create or replace function public.transfer_team_ownership(
  target_team_id uuid,
  new_owner_user_id uuid,
  previous_owner_role text default 'admin'
)
returns table (
  user_id uuid,
  display_name text,
  email text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  clean_previous_role text;
begin
  if not public.is_team_owner(target_team_id) then
    raise exception 'Endast lagägaren kan överlåta ägarskapet.';
  end if;

  if new_owner_user_id = auth.uid() then
    raise exception 'Välj en annan medlem som ny lagägare.';
  end if;

  if not exists (
    select 1 from public.team_members tm
    where tm.team_id = target_team_id
      and tm.user_id = new_owner_user_id
      and tm.role in ('admin', 'member')
  ) then
    raise exception 'Den nya lagägaren måste redan vara medlem i laget.';
  end if;

  clean_previous_role := lower(trim(coalesce(previous_owner_role, 'admin')));
  if clean_previous_role not in ('admin', 'member', 'leave') then
    raise exception 'Välj Lagadmin, Användare eller Lämna laget.';
  end if;

  if clean_previous_role = 'leave' then
    delete from public.team_members tm
    where tm.team_id = target_team_id
      and tm.user_id = auth.uid()
      and tm.role = 'owner';
  else
    update public.team_members tm
    set role = clean_previous_role
    where tm.team_id = target_team_id
      and tm.user_id = auth.uid()
      and tm.role = 'owner';
  end if;

  update public.team_members tm
  set role = 'owner'
  where tm.team_id = target_team_id
    and tm.user_id = new_owner_user_id;

  if not found then
    raise exception 'Ägarskapet kunde inte överlåtas.';
  end if;

  return query
  select lm.user_id, lm.display_name, lm.email, lm.role, lm.created_at
  from public.list_team_members(target_team_id) lm;
end;
$$;

create or replace function public.leave_team(target_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Du måste vara inloggad för att lämna laget.';
  end if;

  if public.is_team_owner(target_team_id) then
    raise exception 'Lagägaren måste först överlåta ägarskapet.';
  end if;

  delete from public.team_members tm
  where tm.team_id = target_team_id
    and tm.user_id = auth.uid();

  if not found then
    raise exception 'Du är inte medlem i laget.';
  end if;
end;
$$;

-- ============================================================
-- supabase/team_player_functions.sql
-- ============================================================

create or replace function public.list_team_players(target_team_id uuid)
returns table (
  id uuid,
  shirt_number numeric,
  name text,
  role text,
  active boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.shirt_number, p.name, p.role, p.active
  from public.players p
  where p.team_id = target_team_id
    and public.is_team_member(target_team_id)
  order by p.active desc, p.shirt_number, p.name;
$$;

create or replace function public.upsert_team_player(
  target_team_id uuid,
  player_id uuid,
  new_shirt_number numeric,
  player_name text,
  player_role text default 'field'
)
returns table (
  id uuid,
  shirt_number numeric,
  name text,
  role text,
  active boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text;
  clean_role text;
begin
  if not public.is_team_admin(target_team_id) then
    raise exception 'Du saknar behörighet att ändra spelare i laget.';
  end if;

  clean_name := trim(player_name);
  clean_role := coalesce(nullif(trim(player_role), ''), 'field');

  if clean_name = '' then
    raise exception 'Ange spelarens namn.';
  end if;

  if new_shirt_number is null then
    raise exception 'Ange spelarens nummer.';
  end if;

  if clean_role not in ('field', 'goalkeeper') then
    raise exception 'Ogiltig roll.';
  end if;

  if player_id is null then
    insert into public.players (team_id, shirt_number, name, role, active)
    values (target_team_id, new_shirt_number, clean_name, clean_role, true)
    on conflict on constraint players_team_id_name_key do update
    set shirt_number = excluded.shirt_number,
        role = excluded.role,
        active = true;
  else
    update public.players p
    set shirt_number = new_shirt_number,
        name = clean_name,
        role = clean_role,
        active = true
    where p.id = player_id
      and p.team_id = target_team_id;
  end if;

  return query
  select lp.id, lp.shirt_number, lp.name, lp.role, lp.active
  from public.list_team_players(target_team_id) lp;
end;
$$;

create or replace function public.set_team_player_active(
  target_team_id uuid,
  player_id uuid,
  is_active boolean
)
returns table (
  id uuid,
  shirt_number numeric,
  name text,
  role text,
  active boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_team_admin(target_team_id) then
    raise exception 'Du saknar behörighet att ändra spelare i laget.';
  end if;

  update public.players p
  set active = is_active
  where p.id = player_id
    and p.team_id = target_team_id;

  return query
  select lp.id, lp.shirt_number, lp.name, lp.role, lp.active
  from public.list_team_players(target_team_id) lp;
end;
$$;

-- ============================================================
-- supabase/team_members_readable_view.sql
-- ============================================================

create or replace view public.team_members_readable
with (security_invoker = true) as
select
  t.name as lag,
  coalesce(nullif(trim(p.display_name), ''), p.email) as namn,
  p.email,
  tm.role as roll,
  tm.created_at as tillagd,
  tm.team_id,
  tm.user_id
from public.team_members tm
join public.teams t
  on t.id = tm.team_id
left join public.profiles p
  on p.user_id = tm.user_id
order by
  t.name,
  case tm.role
    when 'owner' then 1
    when 'admin' then 2
    else 3
  end,
  coalesce(nullif(trim(p.display_name), ''), p.email),
  p.email;

revoke all on public.team_members_readable from public;
revoke all on public.team_members_readable from anon;
revoke all on public.team_members_readable from authenticated;

-- ============================================================
-- supabase/fix_security_definer_permissions.sql
-- ============================================================

-- SECURITY DEFINER functions receive EXECUTE privileges for PUBLIC by default.
-- Keep app RPCs available to signed-in users, but prevent anonymous calls.

revoke execute on function public.is_team_member(uuid) from public, anon;
grant execute on function public.is_team_member(uuid) to authenticated;

revoke execute on function public.is_team_admin(uuid) from public, anon;
grant execute on function public.is_team_admin(uuid) to authenticated;

revoke execute on function public.is_team_owner(uuid) from public, anon;
grant execute on function public.is_team_owner(uuid) to authenticated;

revoke execute on function public.create_team_for_current_user(text) from public, anon;
grant execute on function public.create_team_for_current_user(text) to authenticated;

revoke execute on function public.schedule_team_deletion(uuid) from public, anon;
grant execute on function public.schedule_team_deletion(uuid) to authenticated;

revoke execute on function public.cancel_team_deletion(uuid) from public, anon;
grant execute on function public.cancel_team_deletion(uuid) to authenticated;

revoke execute on function public.is_system_admin() from public, anon;
grant execute on function public.is_system_admin() to authenticated;

revoke execute on function public.get_created_team_count(uuid) from public, anon;
grant execute on function public.get_created_team_count(uuid) to authenticated;

revoke execute on function public.get_my_account_access() from public, anon;
grant execute on function public.get_my_account_access() to authenticated;

revoke execute on function public.list_system_users() from public, anon;
grant execute on function public.list_system_users() to authenticated;

revoke execute on function public.update_system_user_access(uuid, text, integer) from public, anon;
grant execute on function public.update_system_user_access(uuid, text, integer) to authenticated;

revoke execute on function public.list_team_members(uuid) from public, anon;
grant execute on function public.list_team_members(uuid) to authenticated;

revoke execute on function public.search_team_member_candidates(uuid, text) from public, anon;
grant execute on function public.search_team_member_candidates(uuid, text) to authenticated;

revoke execute on function public.add_team_member_by_email(uuid, text, text) from public, anon;
grant execute on function public.add_team_member_by_email(uuid, text, text) to authenticated;

revoke execute on function public.update_team_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.update_team_member_role(uuid, uuid, text) to authenticated;

revoke execute on function public.remove_team_member(uuid, uuid) from public, anon;
grant execute on function public.remove_team_member(uuid, uuid) to authenticated;

revoke execute on function public.transfer_team_ownership(uuid, uuid, text) from public, anon;
grant execute on function public.transfer_team_ownership(uuid, uuid, text) to authenticated;

revoke execute on function public.leave_team(uuid) from public, anon;
grant execute on function public.leave_team(uuid) to authenticated;

revoke execute on function public.list_team_players(uuid) from public, anon;
grant execute on function public.list_team_players(uuid) to authenticated;

revoke execute on function public.upsert_team_player(uuid, uuid, numeric, text, text) from public, anon;
grant execute on function public.upsert_team_player(uuid, uuid, numeric, text, text) to authenticated;

revoke execute on function public.set_team_player_active(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_team_player_active(uuid, uuid, boolean) to authenticated;

-- This function is called by the auth.users trigger, not by clients.
revoke execute on function public.handle_new_user_profile() from public, anon, authenticated;

revoke execute on function public.protect_profile_access_fields() from public, anon, authenticated;
