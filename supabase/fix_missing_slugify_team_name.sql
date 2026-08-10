create or replace function public.slugify_team_name(team_name text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(trim(team_name)), '[^a-z0-9]+', '-', 'g'));
$$;
