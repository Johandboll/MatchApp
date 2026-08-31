import { act, renderHook, waitFor } from "@testing-library/react";
import { supabase } from "../lib/supabaseClient";
import { useTeamSeasons } from "./useTeamSeasons";

jest.mock("../lib/supabaseClient", () => ({
  supabase: { rpc: jest.fn() }
}));

const season = {
  team_season_id: "season-1",
  season_name: "2026/2027",
  display_name: "P14"
};
const roster = [
  { id: "player-1", name: "Anna", shirt_number: 9, role: "field", active: true }
];

test("keeps the last season roster when a refresh temporarily loses the network", async () => {
  supabase.rpc.mockImplementation((name) => {
    if (name === "list_team_seasons") return Promise.resolve({ data: [season], error: null });
    if (name === "list_team_season_roster") return Promise.resolve({ data: roster, error: null });
    return Promise.resolve({ data: [], error: null });
  });

  const { result } = renderHook(() =>
    useTeamSeasons(
      { id: "user-1" },
      { id: "p14", onlineId: "team-1" },
      "2026/2027"
    )
  );

  await waitFor(() => expect(result.current.roster).toEqual(roster));

  supabase.rpc.mockImplementation((name) => {
    if (name === "list_team_seasons") {
      return Promise.resolve({ data: null, error: { message: "TypeError: Failed to fetch" } });
    }
    return Promise.resolve({ data: [], error: null });
  });

  await act(async () => {
    await result.current.refresh();
  });

  expect(result.current.roster).toEqual(roster);
  expect(result.current.activeTeamSeason).toEqual(season);
  expect(result.current.error).toBe("TypeError: Failed to fetch");
});
