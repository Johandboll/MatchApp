import { renderHook, waitFor } from "@testing-library/react";
import { supabase } from "../lib/supabaseClient";
import { storageKey } from "../lib/storageKeys";
import { useAccountAccess } from "./useAccountAccess";

jest.mock("../lib/supabaseClient", () => ({
  supabase: { rpc: jest.fn() }
}));

const user = { id: "user-1" };

beforeEach(() => {
  supabase.rpc.mockReset();
  localStorage.clear();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
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

test("does not reload access when Supabase refreshes the same user session", async () => {
  supabase.rpc.mockResolvedValue({
    data: [{ account_status: "approved", can_create_team: true }],
    error: null
  });

  const { result, rerender } = renderHook(
    ({ currentUser }) => useAccountAccess(currentUser),
    { initialProps: { currentUser: { id: "user-1", tokenMarker: "old" } } }
  );

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(supabase.rpc).toHaveBeenCalledTimes(1);

  rerender({ currentUser: { id: "user-1", tokenMarker: "new" } });

  expect(result.current.loading).toBe(false);
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
});

test("uses previously approved access during an offline cold start without admin rights", async () => {
  supabase.rpc.mockResolvedValueOnce({
    data: [{
      account_status: "approved",
      team_create_limit: 10,
      is_system_admin: true,
      can_create_team: true
    }],
    error: null
  });

  const first = renderHook(() => useAccountAccess(user));
  await waitFor(() => expect(first.result.current.loading).toBe(false));
  first.unmount();

  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  supabase.rpc.mockClear();
  const offline = renderHook(() => useAccountAccess(user));

  await waitFor(() => expect(offline.result.current.loading).toBe(false));
  expect(offline.result.current.accountStatus).toBe("approved");
  expect(offline.result.current.usingCache).toBe(true);
  expect(offline.result.current.isSystemAdmin).toBe(false);
  expect(offline.result.current.canCreateTeam).toBe(false);
  expect(supabase.rpc).not.toHaveBeenCalled();
});

test("allows limited offline match access when the team cache predates the access cache", async () => {
  localStorage.setItem(storageKey("supabase-teams-cache"), JSON.stringify({
    "user-1": [{ id: "p14", onlineId: "team-1", name: "P14" }]
  }));
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });

  const { result } = renderHook(() => useAccountAccess(user));

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.accountStatus).toBe("approved");
  expect(result.current.usingCache).toBe(true);
  expect(result.current.isSystemAdmin).toBe(false);
  expect(result.current.canCreateTeam).toBe(false);
  expect(supabase.rpc).not.toHaveBeenCalled();
});
