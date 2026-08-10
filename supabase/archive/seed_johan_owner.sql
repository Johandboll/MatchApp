insert into public.teams (name, slug)
values
  ('P16/19', 'p16-19'),
  ('P13/14', 'p13-14')
on conflict (slug) do update
set name = excluded.name;

insert into public.team_members (team_id, user_id, role)
select id, '17096d7f-7124-4fac-a9f5-9107e3b7bda5'::uuid, 'owner'
from public.teams
where slug in ('p16-19', 'p13-14')
on conflict (team_id, user_id) do update
set role = excluded.role;

update public.profiles
set account_status = 'approved',
    team_create_limit = greatest(team_create_limit, 10),
    is_system_admin = true,
    updated_at = now()
where user_id = '17096d7f-7124-4fac-a9f5-9107e3b7bda5'::uuid;
