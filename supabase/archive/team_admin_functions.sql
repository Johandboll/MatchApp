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
