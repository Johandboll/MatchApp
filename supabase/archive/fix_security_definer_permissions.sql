-- SECURITY DEFINER functions receive EXECUTE privileges for PUBLIC by default.
-- Keep app RPCs available to signed-in users, but prevent anonymous calls.

revoke execute on function public.is_team_member(uuid) from public, anon;
grant execute on function public.is_team_member(uuid) to authenticated;

revoke execute on function public.is_team_admin(uuid) from public, anon;
grant execute on function public.is_team_admin(uuid) to authenticated;

revoke execute on function public.is_team_owner(uuid) from public, anon;
grant execute on function public.is_team_owner(uuid) to authenticated;

revoke execute on function public.create_team_for_current_user(text) from public, anon;
grant execute on function public.create_team_for_current_user(text) to authenticated;

revoke execute on function public.is_system_admin() from public, anon;
grant execute on function public.is_system_admin() to authenticated;

revoke execute on function public.get_created_team_count(uuid) from public, anon;
grant execute on function public.get_created_team_count(uuid) to authenticated;

revoke execute on function public.get_my_account_access() from public, anon;
grant execute on function public.get_my_account_access() to authenticated;

revoke execute on function public.list_system_users() from public, anon;
grant execute on function public.list_system_users() to authenticated;

revoke execute on function public.update_system_user_access(uuid, text, integer) from public, anon;
grant execute on function public.update_system_user_access(uuid, text, integer) to authenticated;

revoke execute on function public.list_team_members(uuid) from public, anon;
grant execute on function public.list_team_members(uuid) to authenticated;

revoke execute on function public.search_team_member_candidates(uuid, text) from public, anon;
grant execute on function public.search_team_member_candidates(uuid, text) to authenticated;

revoke execute on function public.add_team_member_by_email(uuid, text, text) from public, anon;
grant execute on function public.add_team_member_by_email(uuid, text, text) to authenticated;

revoke execute on function public.update_team_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.update_team_member_role(uuid, uuid, text) to authenticated;

revoke execute on function public.remove_team_member(uuid, uuid) from public, anon;
grant execute on function public.remove_team_member(uuid, uuid) to authenticated;

revoke execute on function public.list_team_players(uuid) from public, anon;
grant execute on function public.list_team_players(uuid) to authenticated;

revoke execute on function public.upsert_team_player(uuid, uuid, numeric, text, text) from public, anon;
grant execute on function public.upsert_team_player(uuid, uuid, numeric, text, text) to authenticated;

revoke execute on function public.set_team_player_active(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_team_player_active(uuid, uuid, boolean) to authenticated;

-- This function is called by the auth.users trigger, not by clients.
revoke execute on function public.handle_new_user_profile() from public, anon, authenticated;

revoke execute on function public.protect_profile_access_fields() from public, anon, authenticated;
