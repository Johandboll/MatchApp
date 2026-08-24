create or replace function public.create_team_season(
  target_team_id uuid,
  new_season_name text,
  new_starts_on date,
  new_ends_on date,
  new_display_name text,
  copy_from_team_season_id uuid default null
)
returns table(
  team_season_id uuid,
  season_id uuid,
  season_name text,
  starts_on date,
  ends_on date,
  display_name text,
  archived_at timestamptz,
  roster_count bigint,
  active_player_count bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  clean_season_name text := btrim(new_season_name);
  clean_display_name text := btrim(new_display_name);
  created_season_id uuid;
  created_team_season_id uuid;
begin
  if not public.is_team_admin(target_team_id) then
    raise exception 'Du saknar behörighet att skapa säsonger för laget.';
  end if;

  if clean_season_name = '' or clean_display_name = '' then
    raise exception 'Ange både säsong och lagnamn.';
  end if;

  if new_starts_on is null or new_ends_on is null or new_ends_on < new_starts_on then
    raise exception 'Kontrollera säsongens start- och slutdatum.';
  end if;

  select s.id into created_season_id
  from private.seasons s
  where lower(s.name) = lower(clean_season_name)
  limit 1;

  if created_season_id is null then
    insert into private.seasons (name, starts_on, ends_on)
    values (clean_season_name, new_starts_on, new_ends_on)
    returning id into created_season_id;
  end if;

  if exists (
    select 1 from private.team_seasons ts
    where ts.team_id = target_team_id and ts.season_id = created_season_id
  ) then
    raise exception 'Laget har redan den säsongen.';
  end if;

  if copy_from_team_season_id is not null and not exists (
    select 1 from private.team_seasons ts
    where ts.id = copy_from_team_season_id and ts.team_id = target_team_id
  ) then
    raise exception 'Truppen som ska kopieras tillhör inte laget.';
  end if;

  insert into private.team_seasons (team_id, season_id, display_name)
  values (target_team_id, created_season_id, clean_display_name)
  returning id into created_team_season_id;

  if copy_from_team_season_id is not null then
    insert into private.player_roster_memberships (
      player_identity_id, team_season_id, shirt_number, role, active, joined_on
    )
    select prm.player_identity_id,
           created_team_season_id,
           prm.shirt_number,
           prm.role,
           true,
           new_starts_on
    from private.player_roster_memberships prm
    where prm.team_season_id = copy_from_team_season_id
      and prm.active
    on conflict on constraint player_roster_memberships_identity_team_unique do nothing;
  end if;

  return query
  select * from public.list_team_seasons(target_team_id);
end;
$function$;
