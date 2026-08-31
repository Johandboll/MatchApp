import {
  buildSeasonOptions,
  buildSeasonSummary,
  getDefaultSeason,
  getSeasonFromDate,
  isActiveMatchTeamUnavailable,
  shouldWaitForOnlineTeams
} from "./appHelpers";

const makeMatch = (player, teamId = "team-old") => ({
  teamId,
  playerRoster: [player],
  stats: {},
  history: []
});

describe("buildSeasonSummary player identity", () => {
  test("connects an old name and shirt number to the current player ID", () => {
    const currentTeam = {
      id: "team-current",
      players: [{ id: "player-anna", nr: 9, shirtNumber: 9, name: "Anna Åberg" }]
    };
    const matches = [
      makeMatch({ nr: 4, name: " Anna  Aberg " }),
      makeMatch({ id: "player-anna", nr: 9, name: "Anna Åberg" }, "team-current")
    ];

    const summary = buildSeasonSummary(matches, [currentTeam]);

    expect(summary.fieldPlayers).toHaveLength(1);
    expect(summary.fieldPlayers[0]).toMatchObject({
      id: "player-anna",
      name: "Anna Åberg",
      nr: 9,
      matches: 2
    });
  });

  test("groups legacy records by normalized name when no player ID exists", () => {
    const matches = [
      makeMatch({ nr: 4, name: "Anna Åberg" }),
      makeMatch({ nr: 9, name: " anna aberg " })
    ];

    const summary = buildSeasonSummary(matches, []);

    expect(summary.fieldPlayers).toHaveLength(1);
    expect(summary.fieldPlayers[0].matches).toBe(2);
  });
});

describe("season options", () => {
  test("derives the season from the match date around June 1", () => {
    expect(getSeasonFromDate("2026-05-31")).toBe("2025/2026");
    expect(getSeasonFromDate("2026-06-01")).toBe("2026/2027");
  });

  test("keeps the current season until May 31", () => {
    const date = new Date(2026, 4, 31, 12);

    expect(getDefaultSeason(date)).toBe("2025/2026");
    expect(buildSeasonOptions(date)).toEqual(["2025/2026"]);
  });

  test("adds the new season on June 1 without future seasons", () => {
    const date = new Date(2026, 5, 1, 12);

    expect(getDefaultSeason(date)).toBe("2026/2027");
    expect(buildSeasonOptions(date)).toEqual(["2025/2026", "2026/2027"]);
  });
});

describe("ongoing match recovery", () => {
  test("detects a saved match whose team is no longer available", () => {
    expect(
      isActiveMatchTeamUnavailable({
        step: 2,
        activeMatchTeamId: "old-team",
        availableTeams: [{ id: "current-team" }],
        teamsLoading: false
      })
    ).toBe(true);
  });

  test("waits for memberships and keeps a match for an available team", () => {
    expect(
      isActiveMatchTeamUnavailable({
        step: 2,
        activeMatchTeamId: "old-team",
        availableTeams: [],
        teamsLoading: true
      })
    ).toBe(false);
    expect(
      isActiveMatchTeamUnavailable({
        step: 2,
        activeMatchTeamId: "current-team",
        availableTeams: [{ id: "current-team" }],
        teamsLoading: false
      })
    ).toBe(false);
  });
});

describe("saved team recovery", () => {
  test("does not choose a fallback team before auth and memberships are ready", () => {
    expect(
      shouldWaitForOnlineTeams({
        supabaseConfigured: true,
        authLoading: true,
        user: null,
        teamsReady: false
      })
    ).toBe(true);

    expect(
      shouldWaitForOnlineTeams({
        supabaseConfigured: true,
        authLoading: false,
        user: { id: "user-1" },
        teamsReady: false
      })
    ).toBe(true);

    expect(
      shouldWaitForOnlineTeams({
        supabaseConfigured: true,
        authLoading: false,
        user: { id: "user-1" },
        teamsReady: true
      })
    ).toBe(false);
  });
});
