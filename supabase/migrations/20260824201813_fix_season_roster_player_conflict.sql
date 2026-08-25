create or replace function public.set_team_season_roster_player(
  target_team_id uuid,
  target_team_season_id uuid,
  target_player_identity_id uuid,
  new_shirt_number integer,
  new_player_role text,
  is_included boolean
)
returns table(
  player_identity_id uuid,
  display_name text,
  shirt_number integer,
  player_role text,
  active boolean,
  included boolean,
  membership_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  clean_role text := coalesce(nullif(btrim(new_player_role), ''), 'field');
begin
  if not public.is_team_admin(target_team_id) then
    raise exception 'Du saknar behörighet att ändra säsongens trupp.';
  end if;

  if not exists (
    select 1 from private.team_seasons ts
    where ts.id = target_team_season_id and ts.team_id = target_team_id
  ) then
    raise exception 'Säsongen tillhör inte laget.';
  end if;

  if clean_role not in ('field', 'goalkeeper') then
    raise exception 'Ogiltig spelarposition.';
  end if;

  if new_shirt_number is not null and (new_shirt_number < 0 or new_shirt_number > 999) then
    raise exception 'Spelarnumret måste vara mellan 0 och 999.';
  end if;

  if is_included then
    if not exists (
      select 1
      from private.player_roster_memberships prm
      join private.team_seasons ts on ts.id = prm.team_season_id
      where ts.team_id = target_team_id
        and prm.player_identity_id = target_player_identity_id
    ) then
      raise exception 'Spelaren finns inte i lagets historik.';
    end if;

    insert into private.player_roster_memberships (
      player_identity_id, team_season_id, shirt_number, role, active
    )
    values (
      target_player_identity_id, target_team_season_id, new_shirt_number, clean_role, true
    )
    on conflict on constraint player_roster_memberships_identity_team_unique do update
    set shirt_number = excluded.shirt_number,
        role = excluded.role,
        active = true;
  else
    update private.player_roster_memberships prm
    set active = false
    where prm.team_season_id = target_team_season_id
      and prm.player_identity_id = target_player_identity_id;
  end if;

  return query
  select * from public.list_team_season_roster(target_team_id, target_team_season_id);
end;
$function$;
