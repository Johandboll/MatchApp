import fs from "fs";
import path from "path";

const sql = fs.readFileSync(
  path.join(process.cwd(), "supabase", "setup_matchapp_2_0_4.sql"),
  "utf8"
);

test("new profiles default to pending with no team creation allowance", () => {
  expect(sql).toMatch(/account_status text not null default 'pending'/);
  expect(sql).toMatch(/team_create_limit integer not null default 0/);
});

test("team creation requires approval and respects the personal limit", () => {
  expect(sql).toMatch(/account_status[\s\S]*<> 'approved'/);
  expect(sql).toMatch(/created_team_count[\s\S]*>=.*team_create_limit/);
});

test("only a team owner may schedule or cancel deletion", () => {
  expect(sql).toMatch(/schedule_team_deletion[\s\S]*is_team_owner\(target_team_id\)/);
  expect(sql).toMatch(/cancel_team_deletion[\s\S]*is_team_owner\(target_team_id\)/);
});

test("team deletion is delayed for 24 hours and can be cancelled", () => {
  expect(sql).toMatch(/now\(\) \+ interval '24 hours'/);
  expect(sql).toMatch(/set deletion_scheduled_at = null/);
});

test("automatic cleanup is scheduled and unavailable to app users", () => {
  expect(sql).toMatch(/deletion_scheduled_at <= now\(\)/);
  expect(sql).toMatch(/'matchapp-purge-scheduled-teams'/);
  expect(sql).toMatch(/revoke execute on function public\.purge_scheduled_teams\(\) from public, anon, authenticated/);
});

test("anonymous users cannot call team mutation RPCs", () => {
  expect(sql).toMatch(/revoke execute on function public\.create_team_for_current_user\(text\) from public, anon/);
  expect(sql).toMatch(/revoke execute on function public\.schedule_team_deletion\(uuid\) from public, anon/);
  expect(sql).toMatch(/revoke execute on function public\.cancel_team_deletion\(uuid\) from public, anon/);
});
