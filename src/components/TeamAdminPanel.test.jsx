import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { supabase } from "../lib/supabaseClient";
import TeamAdminPanel from "./TeamAdminPanel";

jest.mock("../lib/supabaseClient", () => ({
  supabase: { rpc: jest.fn() }
}));

const owner = { id: "owner-1", email: "owner@example.com" };
const team = {
  id: "testlag",
  onlineId: "team-1",
  name: "Testlaget",
  membershipRole: "owner"
};
const players = [
  { id: "player-1", shirt_number: 9, name: "Anna", role: "field", active: true },
  { id: "player-2", shirt_number: 12, name: "Bea", role: "goalkeeper", active: true }
];
const members = [
  { user_id: owner.id, display_name: "Ägaren", email: owner.email, role: "owner" },
  { user_id: "member-1", display_name: "Medlemmen", email: "member@example.com", role: "member" }
];

const renderPanel = (overrides = {}) => render(
  <TeamAdminPanel
    open
    team={team}
    teams={[team]}
    selectedTeamId={team.id}
    accountAccess={{ canCreateTeam: false, createdTeamCount: 1, teamCreateLimit: 1 }}
    currentUser={owner}
    currentUserRole="owner"
    onClose={jest.fn()}
    onToast={jest.fn()}
    onPlayersChanged={jest.fn()}
    onConfirm={jest.fn()}
    onTeamDeletionChanged={jest.fn()}
    onTeamMembershipChanged={jest.fn()}
    {...overrides}
  />
);

beforeEach(() => {
  supabase.rpc.mockReset();
  supabase.rpc.mockImplementation((name) => {
    if (name === "list_team_members") return Promise.resolve({ data: members, error: null });
    if (name === "list_team_players") return Promise.resolve({ data: players, error: null });
    return Promise.resolve({ data: [], error: null });
  });
});

test("opens player editing directly on the selected row", async () => {
  renderPanel();
  const anna = await screen.findByText("Anna");
  const annaRow = anna.closest("div.border-b");

  fireEvent.click(within(annaRow).getByRole("button", { name: "Ändra" }));

  expect(within(annaRow).getByRole("textbox", { name: "Spelarnamn" })).toHaveValue("Anna");
  expect(within(annaRow).getByRole("spinbutton", { name: "Spelarnummer" })).toHaveValue(9);
  expect(within(annaRow).getByRole("button", { name: "Spara" })).toBeVisible();
  expect(screen.getByText("Bea")).toBeVisible();
});

test("explains how to move a team when a new season is available", async () => {
  renderPanel();

  expect(await screen.findByText("Ny säsong är tillgänglig")).toBeVisible();
  expect(screen.getByText(/Historiken ligger kvar/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Starta ny säsong" })).toBeVisible();
});

test("cancels inline player editing without saving", async () => {
  renderPanel();
  const anna = await screen.findByText("Anna");
  const annaRow = anna.closest("div.border-b");

  fireEvent.click(within(annaRow).getByRole("button", { name: "Ändra" }));
  fireEvent.change(within(annaRow).getByRole("textbox", { name: "Spelarnamn" }), {
    target: { value: "Ändrat namn" }
  });
  fireEvent.click(within(annaRow).getByRole("button", { name: "Avbryt" }));

  expect(await screen.findByText("Anna")).toBeVisible();
  expect(screen.queryByDisplayValue("Ändrat namn")).not.toBeInTheDocument();
  expect(supabase.rpc).not.toHaveBeenCalledWith("upsert_team_player", expect.anything());
});

test("keeps player administration in sync with the active season", async () => {
  const onSeasonRefresh = jest.fn().mockResolvedValue();
  renderPanel({
    selectedSeason: "2026/2027",
    teamSeasons: [{ team_season_id: "season-2", season_name: "2026/2027" }],
    activeTeamSeason: { team_season_id: "season-2", season_name: "2026/2027" },
    seasonRoster: players,
    onSeasonRefresh
  });
  const anna = await screen.findByText("Anna");
  const annaRow = anna.closest("div.border-b");

  fireEvent.click(within(annaRow).getByRole("button", { name: "Ändra" }));
  fireEvent.change(within(annaRow).getByRole("spinbutton", { name: "Spelarnummer" }), {
    target: { value: "14" }
  });
  fireEvent.click(within(annaRow).getByRole("button", { name: "Spara" }));

  await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith("upsert_team_season_player", {
    target_team_id: "team-1",
    target_team_season_id: "season-2",
    player_id: "player-1",
    new_shirt_number: 14,
    player_name: "Anna",
    player_role: "field"
  }));
  expect(onSeasonRefresh).toHaveBeenCalledWith("2026/2027");
});

test("lets only the owner rename the active season", async () => {
  const onSeasonRefresh = jest.fn().mockResolvedValue();
  const onToast = jest.fn();
  renderPanel({
    selectedSeason: "2026/2027",
    teamSeasons: [{ team_season_id: "season-2", season_name: "2026/2027", display_name: "Testlaget" }],
    activeTeamSeason: { team_season_id: "season-2", season_name: "2026/2027", display_name: "Testlaget" },
    seasonRoster: players,
    onSeasonRefresh,
    onToast
  });

  fireEvent.click(await screen.findByRole("button", { name: "Ändra lagnamn" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Lagnamn för aktuell säsong" }), {
    target: { value: "Testlaget P16" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Spara" }));

  await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith("update_team_season_display_name", {
    target_team_id: "team-1",
    target_team_season_id: "season-2",
    new_display_name: "Testlaget P16"
  }));
  expect(onSeasonRefresh).toHaveBeenCalledWith("2026/2027");
  expect(onToast).toHaveBeenCalledWith("Lagnamnet är ändrat för aktuell säsong");
});

test("shows the active season roster instead of the legacy player list", async () => {
  renderPanel({
    selectedSeason: "2026/2027",
    teamSeasons: [{ team_season_id: "season-2", season_name: "2026/2027" }],
    activeTeamSeason: { team_season_id: "season-2", season_name: "2026/2027" },
    seasonRoster: [
      { id: "season-player-1", shirt_number: 14, name: "Aktiv spelare", role: "field", active: true },
      { id: "season-player-2", shirt_number: 33, name: "Frank", role: "field", active: false }
    ]
  });

  expect(await screen.findByText("Aktiv spelare")).toBeVisible();
  expect(screen.getByText("Frank")).toBeVisible();
  expect(screen.getByText("1 aktiva")).toBeVisible();
  expect(supabase.rpc).not.toHaveBeenCalledWith("list_team_players", expect.anything());
});

test("shows undo and deletion time for a scheduled team", async () => {
  renderPanel({
    team: { ...team, deletionScheduledAt: "2026-08-12T12:00:00.000Z" }
  });

  fireEvent.click(await screen.findByRole("button", { name: "Medlemmar" }));

  expect(await screen.findByRole("button", { name: "Ångra radering" })).toBeVisible();
  expect(screen.getByText(/Laget raderas/)).toBeVisible();
});

test("lets the owner choose a successor and their own next role", async () => {
  renderPanel();
  fireEvent.click(await screen.findByRole("button", { name: "Medlemmar" }));
  fireEvent.click(await screen.findByRole("button", { name: "Gör till lagägare" }));

  expect(screen.getByText(/Överlåt ägarskapet till Medlemmen/)).toBeVisible();
  expect(screen.getByRole("combobox", { name: "Din roll efter överlåtelsen" })).toHaveValue("admin");
  expect(screen.getByRole("option", { name: "Bli Lagadmin" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Bli Användare" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Lämna laget" })).toBeInTheDocument();
});

test("shows leave team to a regular user", async () => {
  renderPanel({
    currentUser: { id: "member-1", email: "member@example.com" },
    currentUserRole: "member"
  });

  expect(await screen.findByRole("button", { name: "Lämna laget" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Ta bort lag" })).not.toBeInTheDocument();
});
