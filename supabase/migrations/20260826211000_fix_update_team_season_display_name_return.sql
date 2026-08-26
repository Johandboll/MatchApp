drop function if exists public.update_team_season_display_name(uuid, uuid, text);

create function public.update_team_season_display_name(
  target_team_id uuid,
  target_team_season_id uuid,
  new_display_name text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  clean_name text := btrim(new_display_name);
begin
  if not public.is_team_owner(target_team_id) then
    raise exception 'Endast lagägaren kan ändra lagets namn.';
  end if;

  if clean_name = '' then
    raise exception 'Ange ett lagnamn.';
  end if;

  update private.team_seasons ts
     set display_name = clean_name
   where ts.id = target_team_season_id
     and ts.team_id = target_team_id;

  if not found then
    raise exception 'Säsongen tillhör inte laget.';
  end if;
end;
$function$;

revoke all on function public.update_team_season_display_name(uuid, uuid, text) from public, anon;
grant execute on function public.update_team_season_display_name(uuid, uuid, text) to authenticated;
