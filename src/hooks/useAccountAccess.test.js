import { renderHook, waitFor } from "@testing-library/react";
import { supabase } from "../lib/supabaseClient";
import { useAccountAccess } from "./useAccountAccess";

jest.mock("../lib/supabaseClient", () => ({
  supabase: { rpc: jest.fn() }
}));

const user = { id: "user-1" };

beforeEach(() => {
  supabase.rpc.mockReset();
});

test.each(["pending", "approved", "blocked"])(
  "maps account status %s from Supabase",
  async (accountStatus) => {
    supabase.rpc.mockResolvedValue({
      data: [{
        account_status: accountStatus,
        team_create_limit: 2,
        created_team_count: 1,
        pending_account_count: 3,
        is_system_admin: accountStatus === "approved",
        can_create_team: accountStatus === "approved"
      }],
      error: null
    });

    const { result } = renderHook(() => useAccountAccess(user));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.accountStatus).toBe(accountStatus);
    expect(result.current.teamCreateLimit).toBe(2);
    expect(result.current.createdTeamCount).toBe(1);
    expect(result.current.pendingAccountCount).toBe(3);
    expect(result.current.canCreateTeam).toBe(accountStatus === "approved");
  }
);

test("fails closed as pending when the access query fails", async () => {
  supabase.rpc.mockResolvedValue({ data: null, error: { message: "network error" } });

  const { result } = renderHook(() => useAccountAccess(user));

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.accountStatus).toBe("pending");
  expect(result.current.canCreateTeam).toBe(false);
  expect(result.current.error).toBe("network error");
});
