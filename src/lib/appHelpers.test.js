import { buildSeasonOptions, buildSeasonSummary, getDefaultSeason } from "./appHelpers";

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
