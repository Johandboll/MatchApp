create or replace function public.list_team_members(target_team_id uuid)
returns table (
  user_id uuid,
  email text,
  role text,
  created_at timestamptz
)
language sql
security definer
set search_path = public, auth
stable
as $$
  select tm.user_id, au.email::text, tm.role, tm.created_at
  from public.team_members tm
  join auth.users au on au.id = tm.user_id
  where tm.team_id = target_team_id
    and public.is_team_member(target_team_id)
  order by
    case tm.role
      when 'owner' then 1
      when 'admin' then 2
      else 3
    end,
    au.email;
$$;

create or replace function public.add_team_member_by_email(
  target_team_id uuid,
  member_email text,
  member_role text default 'member'
)
returns table (
  user_id uuid,
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
begin
  if not public.is_team_admin(target_team_id) then
    raise exception 'Du saknar behörighet att lägga till medlemmar i laget.';
  end if;

  clean_email := lower(trim(member_email));
  clean_role := coalesce(nullif(trim(member_role), ''), 'member');

  if clean_role not in ('admin', 'member') then
    raise exception 'Ogiltig roll. Välj admin eller member.';
  end if;

  select au.id into target_user_id
  from auth.users au
  where lower(au.email) = clean_email
  limit 1;

  if target_user_id is null then
    raise exception 'Det finns inget konto med den e-postadressen ännu.';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (target_team_id, target_user_id, clean_role)
  on conflict on constraint team_members_pkey do update
  set role = excluded.role;

  return query
  select lm.user_id, lm.email, lm.role, lm.created_at
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
  if not public.is_team_admin(target_team_id) then
    raise exception 'Du saknar behörighet att ändra medlemmar i laget.';
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
  select lm.user_id, lm.email, lm.role, lm.created_at
  from public.list_team_members(target_team_id) lm;
end;
$$;

create or replace function public.remove_team_member(
  target_team_id uuid,
  target_user_id uuid
)
returns table (
  user_id uuid,
  email text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_team_admin(target_team_id) then
    raise exception 'Du saknar behörighet att ta bort medlemmar i laget.';
  end if;

  delete from public.team_members tm
  where tm.team_id = target_team_id
    and tm.user_id = target_user_id
    and tm.role <> 'owner';

  return query
  select lm.user_id, lm.email, lm.role, lm.created_at
  from public.list_team_members(target_team_id) lm;
end;
$$;
