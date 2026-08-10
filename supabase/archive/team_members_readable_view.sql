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
