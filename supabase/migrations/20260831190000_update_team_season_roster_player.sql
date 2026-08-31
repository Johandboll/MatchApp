create or replace function public.update_team_season_roster_player(
  target_team_id uuid,
  target_team_season_id uuid,
  target_player_identity_id uuid,
  new_display_name text,
  new_shirt_number integer,
  new_player_role text
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
  clean_name text := btrim(new_display_name);
  clean_role text := coalesce(nullif(btrim(new_player_role), ''), 'field');
begin
  if not public.is_team_admin(target_team_id) then
    raise exception 'Du saknar behörighet att ändra säsongens trupp.';
  end if;

  if clean_name = '' then
    raise exception 'Ange spelarens namn.';
  end if;

  if clean_role not in ('field', 'goalkeeper') then
    raise exception 'Ogiltig spelarposition.';
  end if;

  if new_shirt_number is null or new_shirt_number < 0 or new_shirt_number > 999 then
    raise exception 'Spelarnumret måste vara mellan 0 och 999.';
  end if;

  if not exists (
    select 1
    from private.player_roster_memberships prm
    join private.team_seasons ts on ts.id = prm.team_season_id
    where prm.player_identity_id = target_player_identity_id
      and prm.team_season_id = target_team_season_id
      and ts.team_id = target_team_id
  ) then
    raise exception 'Spelaren finns inte i lagets säsongstrupp.';
  end if;

  update private.player_identities pi
     set display_name = clean_name,
         updated_at = now()
   where pi.id = target_player_identity_id;

  update private.player_roster_memberships prm
     set shirt_number = new_shirt_number,
         role = clean_role
   where prm.player_identity_id = target_player_identity_id
     and prm.team_season_id = target_team_season_id;

  update public.players p
     set name = clean_name,
         shirt_number = new_shirt_number,
         role = clean_role
    from private.player_roster_memberships prm
   where prm.player_identity_id = target_player_identity_id
     and prm.team_season_id = target_team_season_id
     and prm.legacy_player_id = p.id
     and p.team_id = target_team_id;

  return query
  select * from public.list_team_season_roster(target_team_id, target_team_season_id);
end;
$function$;

revoke all on function public.update_team_season_roster_player(uuid, uuid, uuid, text, integer, text) from public, anon;
grant execute on function public.update_team_season_roster_player(uuid, uuid, uuid, text, integer, text) to authenticated;
