alter table public.players
drop constraint if exists players_team_id_shirt_number_key;

alter table public.players
add constraint players_team_id_name_key unique (team_id, name);

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
