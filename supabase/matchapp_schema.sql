create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  shirt_number numeric not null,
  name text not null,
  role text not null default 'field' check (role in ('field', 'goalkeeper')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (team_id, shirt_number)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  match_info jsonb not null default '{}'::jsonb,
  match_type text not null default 'series' check (match_type in ('series', 'cup')),
  cup_name text not null default '',
  cup_phase text not null default '',
  result jsonb not null default '{}'::jsonb,
  selected_players jsonb not null default '[]'::jsonb,
  player_roster jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;

create or replace function public.is_team_member(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = target_team_id
      and tm.user_id = auth.uid()
  );
$$;

create or replace function public.is_team_admin(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = target_team_id
      and tm.user_id = auth.uid()
      and tm.role in ('owner', 'admin')
  );
$$;

create policy "members can read their teams"
on public.teams for select
to authenticated
using (public.is_team_member(id));

create policy "users can read their own team memberships"
on public.team_members for select
to authenticated
using (user_id = (select auth.uid()));

create policy "admins can insert team memberships"
on public.team_members for insert
to authenticated
with check (public.is_team_admin(team_id));

create policy "admins can update team memberships"
on public.team_members for update
to authenticated
using (public.is_team_admin(team_id))
with check (public.is_team_admin(team_id));

create policy "admins can delete team memberships"
on public.team_members for delete
to authenticated
using (public.is_team_admin(team_id));

create policy "members can read players"
on public.players for select
to authenticated
using (public.is_team_member(team_id));

create policy "admins can insert players"
on public.players for insert
to authenticated
with check (public.is_team_admin(team_id));

create policy "admins can update players"
on public.players for update
to authenticated
using (public.is_team_admin(team_id))
with check (public.is_team_admin(team_id));

create policy "admins can delete players"
on public.players for delete
to authenticated
using (public.is_team_admin(team_id));

create policy "members can read matches"
on public.matches for select
to authenticated
using (public.is_team_member(team_id));

create policy "members can create matches"
on public.matches for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and public.is_team_member(team_id)
);

create policy "members can update matches"
on public.matches for update
to authenticated
using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

create policy "admins can delete matches"
on public.matches for delete
to authenticated
using (public.is_team_admin(team_id));
