drop policy if exists "members can read their teams" on public.teams;
drop policy if exists "members can read team memberships" on public.team_members;
drop policy if exists "users can read their own team memberships" on public.team_members;
drop policy if exists "admins can manage team memberships" on public.team_members;
drop policy if exists "members can read players" on public.players;
drop policy if exists "admins can manage players" on public.players;
drop policy if exists "members can read matches" on public.matches;
drop policy if exists "members can create matches" on public.matches;
drop policy if exists "members can update matches" on public.matches;
drop policy if exists "admins can delete matches" on public.matches;

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
using (public.is_team_member(id));

create policy "users can read their own team memberships"
on public.team_members for select
using (user_id = auth.uid());

create policy "admins can manage team memberships"
on public.team_members for all
using (public.is_team_admin(team_id))
with check (public.is_team_admin(team_id));

create policy "members can read players"
on public.players for select
using (public.is_team_member(team_id));

create policy "admins can manage players"
on public.players for all
using (public.is_team_admin(team_id))
with check (public.is_team_admin(team_id));

create policy "members can read matches"
on public.matches for select
using (public.is_team_member(team_id));

create policy "members can create matches"
on public.matches for insert
with check (
  created_by = auth.uid()
  and public.is_team_member(team_id)
);

create policy "members can update matches"
on public.matches for update
using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

create policy "admins can delete matches"
on public.matches for delete
using (public.is_team_admin(team_id));
