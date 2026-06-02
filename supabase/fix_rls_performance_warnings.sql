-- Avoid per-row auth.uid() evaluation and overlapping permissive policies.
-- Run this once in the Supabase SQL Editor, then rerun the Performance Advisor.

drop policy if exists "users can read their own team memberships" on public.team_members;
drop policy if exists "admins can manage team memberships" on public.team_members;
drop policy if exists "admins can insert team memberships" on public.team_members;
drop policy if exists "admins can update team memberships" on public.team_members;
drop policy if exists "admins can delete team memberships" on public.team_members;
drop policy if exists "members can read players" on public.players;
drop policy if exists "admins can manage players" on public.players;
drop policy if exists "admins can insert players" on public.players;
drop policy if exists "admins can update players" on public.players;
drop policy if exists "admins can delete players" on public.players;
drop policy if exists "members can create matches" on public.matches;
drop policy if exists "members can read their teams" on public.teams;
drop policy if exists "members can read matches" on public.matches;
drop policy if exists "members can update matches" on public.matches;
drop policy if exists "admins can delete matches" on public.matches;
drop policy if exists "users can read their own profile" on public.profiles;
drop policy if exists "users can update their own profile" on public.profiles;
drop policy if exists "users can insert their own profile" on public.profiles;

create policy "users can read their own team memberships"
on public.team_members for select
to authenticated
using (user_id = (select auth.uid()));

create policy "members can read their teams"
on public.teams for select
to authenticated
using (public.is_team_member(id));

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

create policy "members can create matches"
on public.matches for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and public.is_team_member(team_id)
);

create policy "members can read matches"
on public.matches for select
to authenticated
using (public.is_team_member(team_id));

create policy "members can update matches"
on public.matches for update
to authenticated
using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

create policy "admins can delete matches"
on public.matches for delete
to authenticated
using (public.is_team_admin(team_id));

create policy "users can read their own profile"
on public.profiles for select
to authenticated
using (user_id = (select auth.uid()));

create policy "users can update their own profile"
on public.profiles for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "users can insert their own profile"
on public.profiles for insert
to authenticated
with check (user_id = (select auth.uid()));
