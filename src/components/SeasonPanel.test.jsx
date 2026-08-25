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
  active_player_count: 1
};

const roster = [{
  player_identity_id: "identity-1",
  display_name: "Anna",
  shirt_number: 9,
  player_role: "field",
  active: true,
  included: true
}];

const renderPanel = (overrides = {}) => render(
  <SeasonPanel
    open
    team={{ onlineId: "team-1", name: "Testlaget" }}
    seasons={[season]}
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
  supabase.rpc.mockResolvedValue({ data: roster, error: null });
});

test("opens directly on the automatically selected season and editable team name", async () => {
  renderPanel();

  expect(screen.getByRole("heading", { name: "Ny säsong" })).toBeVisible();
  expect(screen.getByText("2026/2027")).toBeVisible();
  expect(screen.getByRole("textbox", { name: "Lagets namn under den nya säsongen" })).toHaveValue("P19");
  await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith("list_team_season_roster", {
    target_team_id: "team-1",
    target_team_season_id: "season-1"
  }));
});

test("lets the owner choose players and edit number and role", async () => {
  renderPanel();
  await waitFor(() => expect(screen.getByRole("button", { name: "Fortsätt" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Fortsätt" }));

  expect(await screen.findByRole("heading", { name: "Spelare som fortsätter" })).toBeVisible();
  expect(screen.getByText("Anna")).toBeVisible();
  fireEvent.change(screen.getByRole("spinbutton", { name: "Tröjnummer" }), { target: { value: "14" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Roll" }), { target: { value: "goalkeeper" } });
  fireEvent.click(screen.getByRole("button", { name: "Fortsätt" }));

  expect(screen.getByRole("heading", { name: "Kontrollera och starta" })).toBeVisible();
  expect(screen.getByText("1 spelare följer med.")).toBeVisible();
  expect(supabase.rpc).not.toHaveBeenCalledWith("create_team_season", expect.anything());
});

test("creates the season and saves the new roster values", async () => {
  const onSeasonChange = jest.fn();
  const onRefresh = jest.fn().mockResolvedValue();
  const onClose = jest.fn();
  supabase.rpc
    .mockResolvedValueOnce({ data: roster, error: null })
    .mockResolvedValueOnce({
      data: [{ team_season_id: "season-2", season_name: "2026/2027" }],
      error: null
    })
    .mockResolvedValueOnce({ data: [], error: null });

  renderPanel({ onSeasonChange, onRefresh, onClose });
  await waitFor(() => expect(screen.getByRole("button", { name: "Fortsätt" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Fortsätt" }));
  fireEvent.change(await screen.findByRole("spinbutton", { name: "Tröjnummer" }), { target: { value: "14" } });
  fireEvent.click(screen.getByRole("button", { name: "Fortsätt" }));
  fireEvent.click(screen.getByRole("button", { name: "Starta säsongen" }));

  await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith("set_team_season_roster_player", {
    target_team_id: "team-1",
    target_team_season_id: "season-2",
    target_player_identity_id: "identity-1",
    new_shirt_number: 14,
    new_player_role: "field",
    is_included: true
  }));
  expect(onSeasonChange).toHaveBeenCalledWith("2026/2027");
  expect(onRefresh).toHaveBeenCalledWith("2026/2027");
  expect(onClose).toHaveBeenCalled();
});
