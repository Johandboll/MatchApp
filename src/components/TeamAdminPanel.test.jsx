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

test("offers one direct action when a new season is needed", async () => {
  renderPanel({
    selectedSeason: "2026/2027",
    teamSeasons: [{
      team_season_id: "season-1",
      season_name: "2025/2026",
      display_name: "P19",
      starts_on: "2025-06-01",
      ends_on: "2026-05-31",
      active_player_count: 2
    }],
    activeTeamSeason: {
      team_season_id: "season-1",
      season_name: "2025/2026",
      display_name: "P19",
      starts_on: "2025-06-01",
      ends_on: "2026-05-31",
      active_player_count: 2
    }
  });

  await screen.findByText("Anna");

  expect(screen.getByRole("button", { name: "Spelare" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Medlemmar" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Säsonger" })).not.toBeInTheDocument();

  expect(screen.getByText("Dags för ny säsong")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Starta ny säsong" }));

  expect(screen.getByRole("dialog", { name: "Hantera säsong" })).toBeVisible();
  expect(screen.getByText("1. Kontrollera säsongen")).toBeVisible();
  await waitFor(() => expect(screen.getByRole("button", { name: "Fortsätt" })).toBeEnabled());
});

test("starts the new season flow one step at a time", async () => {
  renderPanel({
    selectedSeason: "2026/2027",
    teamSeasons: [{
      team_season_id: "season-1",
      season_name: "2025/2026",
      display_name: "P19",
      starts_on: "2025-06-01",
      ends_on: "2026-05-31",
      active_player_count: 2
    }],
    activeTeamSeason: {
      team_season_id: "season-1",
      season_name: "2025/2026",
      display_name: "P19",
      starts_on: "2025-06-01",
      ends_on: "2026-05-31",
      active_player_count: 2
    }
  });

  await screen.findByText("Anna");

  fireEvent.click(screen.getByRole("button", { name: "Starta ny säsong" }));

  expect(screen.getByText("1. Kontrollera säsongen")).toBeVisible();
  expect(screen.getByText("2026/2027")).toBeVisible();
  expect(screen.queryByText("2. Välj spelare som fortsätter")).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "Fortsätt" })).toBeEnabled());
});
