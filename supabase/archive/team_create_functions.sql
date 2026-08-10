create or replace function public.slugify_team_name(team_name text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(trim(team_name)), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.create_team_for_current_user(team_name text)
returns table (
  id uuid,
  name text,
  slug text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text;
  base_slug text;
  new_team_id uuid;
  user_access record;
begin
  if auth.uid() is null then
    raise exception 'Du måste vara inloggad för att skapa lag.';
  end if;

  select *
  into user_access
  from public.get_my_account_access();

  if coalesce(user_access.account_status, 'pending') <> 'approved' then
    raise exception 'Kontot måste vara godkänt innan du kan skapa lag.';
  end if;

  if coalesce(user_access.created_team_count, 0) >= coalesce(user_access.team_create_limit, 0) then
    raise exception 'Du har nått din gräns för att skapa lag.';
  end if;

  clean_name := trim(team_name);

  if clean_name = '' then
    raise exception 'Ange ett lagnamn.';
  end if;

  base_slug := public.slugify_team_name(clean_name);

  if base_slug = '' then
    base_slug := 'lag';
  end if;

  if exists (
    select 1
    from public.teams t
    where public.slugify_team_name(t.name) = base_slug
       or t.slug = base_slug
  ) then
    raise exception 'Det finns redan ett lag med det namnet. Be en ägare eller admin i laget lägga till dig istället.';
  end if;

  insert into public.teams (name, slug)
  values (clean_name, base_slug)
  returning teams.id into new_team_id;

  insert into public.team_members (team_id, user_id, role)
  values (new_team_id, auth.uid(), 'owner');

  return query
  select t.id, t.name, t.slug
  from public.teams t
  where t.id = new_team_id;
end;
$$;
