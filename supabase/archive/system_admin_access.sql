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
