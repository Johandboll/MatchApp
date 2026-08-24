import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { supabase } from "../lib/supabaseClient";
import SeasonPanel from "./SeasonPanel";

jest.mock("../lib/supabaseClient", () => ({
  supabase: { rpc: jest.fn() }
}));

const season = {
  team_season_id: "season-1",
  season_name: "2025/2026",
  display_name: "P19",
  starts_on: "2025-06-01",
  ends_on: "2026-05-31",
  active_player_count: 2
};

const renderSeasonPanel = (overrides = {}) => render(
  <SeasonPanel
    open
    team={{ onlineId: "team-1", name: "Testlaget" }}
    selectedSeason="2025/2026"
    seasons={[season]}
    activeTeamSeason={season}
    roster={[]}
    onSeasonChange={jest.fn()}
    onRefresh={jest.fn()}
    onToast={jest.fn()}
    onClose={jest.fn()}
    today={new Date(2026, 7, 1)}
    {...overrides}
  />
);

beforeEach(() => {
  supabase.rpc.mockReset();
  supabase.rpc.mockResolvedValue({ data: [], error: null });
});

test("keeps the overview compact until the user starts a new season", () => {
  renderSeasonPanel();

  expect(screen.getByText("Nuvarande trupp")).toBeVisible();
  expect(screen.getByRole("button", { name: "Starta ny säsong" })).toBeVisible();
  expect(screen.queryByText("1. Den nya säsongen")).not.toBeInTheDocument();
});

test("shows the current season once without a duplicate status card", () => {
  const currentSeason = {
    ...season,
    team_season_id: "season-2",
    season_name: "2026/2027",
    display_name: "P15",
    starts_on: "2026-06-01",
    ends_on: "2027-05-31",
    active_player_count: 4
  };

  renderSeasonPanel({
    selectedSeason: "2026/2027",
    seasons: [currentSeason, season],
    activeTeamSeason: currentSeason
  });

  expect(screen.getByText("Aktuell säsong")).toBeVisible();
  expect(screen.getByText("P15")).toBeVisible();
  expect(screen.getByText("Visas nu")).toBeVisible();
  expect(screen.queryByText("Aktuell säsong är klar")).not.toBeInTheDocument();
  expect(screen.getByText("Tidigare säsonger")).toBeVisible();
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
  await waitFor(() => expect(screen.getByRole("button", { name: "Fortsätt" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Fortsätt" }));
  expect(await screen.findByText("2. Välj spelare som fortsätter")).toBeVisible();
  expect(screen.getByText("Anna")).toBeVisible();
  expect(supabase.rpc).toHaveBeenCalledWith("list_team_season_roster", {
    target_team_id: "team-1",
    target_team_season_id: "season-1"
  });
  expect(supabase.rpc).not.toHaveBeenCalledWith("create_team_season", expect.anything());

  fireEvent.click(screen.getByRole("button", { name: "Fortsätt" }));
  await waitFor(() => expect(screen.getByText("3. Bekräfta")).toBeVisible());
  expect(screen.getByText(/1 spelare följer med/)).toBeVisible();
});

test("selects and refreshes the newly created season", async () => {
  const onSeasonChange = jest.fn();
  const onRefresh = jest.fn().mockResolvedValue();
  supabase.rpc
    .mockResolvedValueOnce({
      data: [{
        player_identity_id: "identity-1",
        display_name: "Anna",
        shirt_number: 9,
        player_role: "field",
        active: true,
        included: true
      }],
      error: null
    })
    .mockResolvedValueOnce({
      data: [{ team_season_id: "season-2", season_name: "2026/2027" }],
      error: null
    });

  renderSeasonPanel({ onSeasonChange, onRefresh });
  fireEvent.click(screen.getByRole("button", { name: "Starta ny säsong" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Fortsätt" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Fortsätt" }));
  fireEvent.click(await screen.findByRole("button", { name: "Fortsätt" }));
  fireEvent.click(await screen.findByRole("button", { name: "Starta säsongen" }));

  await waitFor(() => expect(onSeasonChange).toHaveBeenCalledWith("2026/2027"));
  expect(onRefresh).toHaveBeenCalledWith("2026/2027");
});
