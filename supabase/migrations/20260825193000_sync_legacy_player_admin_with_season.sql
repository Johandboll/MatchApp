create or replace function public.upsert_team_season_player(
  target_team_id uuid,
  target_team_season_id uuid,
  player_id uuid,
  new_shirt_number numeric,
  player_name text,
  player_role text default 'field'
)
returns table(id uuid, shirt_number numeric, name text, role text, active boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  clean_name text := btrim(player_name);
  clean_role text := coalesce(nullif(btrim(player_role), ''), 'field');
  legacy_id uuid;
  identity_id uuid;
begin
  if not public.is_team_admin(target_team_id) then
    raise exception 'Du saknar behörighet att ändra spelare i laget.';
  end if;
  if not exists (
    select 1 from private.team_seasons ts
    where ts.id = target_team_season_id and ts.team_id = target_team_id
  ) then
    raise exception 'Säsongen tillhör inte laget.';
  end if;
  if clean_name = '' then raise exception 'Ange spelarens namn.'; end if;
  if new_shirt_number is null or new_shirt_number <> trunc(new_shirt_number)
    or new_shirt_number < 0 or new_shirt_number > 999 then
    raise exception 'Spelarnumret måste vara ett heltal mellan 0 och 999.';
  end if;
  if clean_role not in ('field', 'goalkeeper') then raise exception 'Ogiltig roll.'; end if;

  if player_id is null then
    insert into public.players (team_id, shirt_number, name, role, active)
    values (target_team_id, new_shirt_number, clean_name, clean_role, true)
    on conflict on constraint players_team_id_name_key do update
      set shirt_number = excluded.shirt_number, role = excluded.role, active = true
    returning players.id into legacy_id;
  else
    update public.players p
       set shirt_number = new_shirt_number, name = clean_name, role = clean_role, active = true
     where p.id = player_id and p.team_id = target_team_id
    returning p.id into legacy_id;
  end if;

  if legacy_id is null then raise exception 'Spelaren kunde inte sparas.'; end if;

  select prm.player_identity_id into identity_id
    from private.player_roster_memberships prm
   where prm.legacy_player_id = legacy_id
   order by prm.created_at
   limit 1;

  if identity_id is null then
    insert into private.player_identities (display_name)
    values (clean_name)
    returning player_identities.id into identity_id;
  else
    update private.player_identities pi
       set display_name = clean_name, updated_at = now()
     where pi.id = identity_id;
  end if;

  insert into private.player_roster_memberships (
    player_identity_id, team_season_id, legacy_player_id, shirt_number, role, active
  )
  values (
    identity_id, target_team_season_id, legacy_id, new_shirt_number::integer, clean_role, true
  )
  on conflict on constraint player_roster_memberships_identity_team_unique do update
    set legacy_player_id = excluded.legacy_player_id,
        shirt_number = excluded.shirt_number,
        role = excluded.role,
        active = true;

  return query select * from public.list_team_players(target_team_id);
end;
$function$;

create or replace function public.set_team_season_player_active(
  target_team_id uuid,
  target_team_season_id uuid,
  player_id uuid,
  is_active boolean
)
returns table(id uuid, shirt_number numeric, name text, role text, active boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if not public.is_team_admin(target_team_id) then
    raise exception 'Du saknar behörighet att ändra spelare i laget.';
  end if;
  if not exists (
    select 1 from private.team_seasons ts
    where ts.id = target_team_season_id and ts.team_id = target_team_id
  ) then
    raise exception 'Säsongen tillhör inte laget.';
  end if;

  update public.players p
     set active = is_active
   where p.id = player_id and p.team_id = target_team_id;

  update private.player_roster_memberships prm
     set active = is_active
   where prm.team_season_id = target_team_season_id
     and prm.legacy_player_id = player_id;

  return query select * from public.list_team_players(target_team_id);
end;
$function$;

revoke all on function public.upsert_team_season_player(uuid, uuid, uuid, numeric, text, text) from public, anon;
grant execute on function public.upsert_team_season_player(uuid, uuid, uuid, numeric, text, text) to authenticated;
revoke all on function public.set_team_season_player_active(uuid, uuid, uuid, boolean) from public, anon;
grant execute on function public.set_team_season_player_active(uuid, uuid, uuid, boolean) to authenticated;
