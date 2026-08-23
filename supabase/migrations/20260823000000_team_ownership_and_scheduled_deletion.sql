-- Production delta for MatchApp 2.0.4.
-- Adds ownership transfer, self-service team exit, and delayed team deletion.

alter table public.teams
  add column if not exists deletion_scheduled_at timestamptz,
  add column if not exists deletion_scheduled_by uuid references auth.users(id) on delete set null;

create unique index if not exists team_members_one_owner_per_team
on public.team_members (team_id)
where role = 'owner';

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
    where tm.team_id = target_team_id and tm.user_id = auth.uid() and tm.role = 'owner';
  else
    update public.team_members tm
    set role = clean_previous_role
    where tm.team_id = target_team_id and tm.user_id = auth.uid() and tm.role = 'owner';
  end if;
  update public.team_members tm
  set role = 'owner'
  where tm.team_id = target_team_id and tm.user_id = new_owner_user_id;
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
  where tm.team_id = target_team_id and tm.user_id = auth.uid();
  if not found then
    raise exception 'Du är inte medlem i laget.';
  end if;
end;
$$;

revoke execute on function public.schedule_team_deletion(uuid) from public, anon;
grant execute on function public.schedule_team_deletion(uuid) to authenticated, service_role;

revoke execute on function public.cancel_team_deletion(uuid) from public, anon;
grant execute on function public.cancel_team_deletion(uuid) to authenticated, service_role;

revoke execute on function public.transfer_team_ownership(uuid, uuid, text) from public, anon;
grant execute on function public.transfer_team_ownership(uuid, uuid, text) to authenticated, service_role;

revoke execute on function public.leave_team(uuid) from public, anon;
grant execute on function public.leave_team(uuid) to authenticated, service_role;

revoke execute on function public.purge_scheduled_teams() from public, anon, authenticated;
grant execute on function public.purge_scheduled_teams() to service_role;

create extension if not exists pg_cron with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'matchapp-purge-scheduled-teams';

select cron.schedule(
  'matchapp-purge-scheduled-teams',
  '*/5 * * * *',
  'select public.purge_scheduled_teams();'
);
