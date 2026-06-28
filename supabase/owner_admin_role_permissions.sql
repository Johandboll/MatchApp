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

revoke execute on function public.is_team_owner(uuid) from public, anon;
grant execute on function public.is_team_owner(uuid) to authenticated;

drop policy if exists "admins can update team memberships" on public.team_members;
drop policy if exists "admins can delete team memberships" on public.team_members;
drop policy if exists "admins can delete players" on public.players;
drop policy if exists "admins can delete matches" on public.matches;

create policy "admins can update team memberships"
on public.team_members for update
to authenticated
using (public.is_team_owner(team_id))
with check (public.is_team_owner(team_id));

create policy "admins can delete team memberships"
on public.team_members for delete
to authenticated
using (public.is_team_owner(team_id));

create policy "admins can delete players"
on public.players for delete
to authenticated
using (public.is_team_owner(team_id));

create policy "admins can delete matches"
on public.matches for delete
to authenticated
using (public.is_team_owner(team_id));

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
