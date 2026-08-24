import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { supabase } from "../lib/supabaseClient";
import SeasonPanel from "./SeasonPanel";

jest.mock("../lib/supabaseClient", () => ({
  supabase: { rpc: jest.fn() }
}));

const season = {
  team_season_id: "season-1",
  season_name: "2026/2027",
  display_name: "P19",
  starts_on: "2026-06-01",
  ends_on: "2027-05-31",
  active_player_count: 2
};

const renderSeasonPanel = (overrides = {}) => render(
  <SeasonPanel
    open
    team={{ onlineId: "team-1", name: "Testlaget" }}
    selectedSeason="2026/2027"
    seasons={[season]}
    activeTeamSeason={season}
    roster={[]}
    onSeasonChange={jest.fn()}
    onRefresh={jest.fn()}
    onToast={jest.fn()}
    onClose={jest.fn()}
    {...overrides}
  />
);

beforeEach(() => {
  supabase.rpc.mockReset();
});

test("keeps the overview compact until the user starts a new season", () => {
  renderSeasonPanel();

  expect(screen.getByText("Vald säsong")).toBeVisible();
  expect(screen.getByRole("button", { name: "Starta ny säsong" })).toBeVisible();
  expect(screen.queryByText("1. Den nya säsongen")).not.toBeInTheDocument();
});

test("walks through details and roster source without creating early", async () => {
  supabase.rpc.mockResolvedValue({
    data: [{
      player_identity_id: "identity-1",
      display_name: "Anna",
      shirt_number: 9,
      player_role: "field",
      active: true,
      included: true
    }],
    error: null
  });
  renderSeasonPanel();

  fireEvent.click(screen.getByRole("button", { name: "Starta ny säsong" }));
  fireEvent.click(screen.getByRole("button", { name: "Fortsätt" }));
  expect(screen.getByText("2. Välj trupp att utgå från")).toBeVisible();
  expect(supabase.rpc).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Fortsätt" }));
  expect(await screen.findByText("3. Välj spelare")).toBeVisible();
  expect(screen.getByText("Anna")).toBeVisible();
  expect(supabase.rpc).toHaveBeenCalledWith("list_team_season_roster", {
    target_team_id: "team-1",
    target_team_season_id: "season-1"
  });
  expect(supabase.rpc).not.toHaveBeenCalledWith("create_team_season", expect.anything());

  fireEvent.click(screen.getByRole("button", { name: "Fortsätt" }));
  await waitFor(() => expect(screen.getByText("4. Bekräfta")).toBeVisible());
  expect(screen.getByText(/1 spelare följer med/)).toBeVisible();
});
