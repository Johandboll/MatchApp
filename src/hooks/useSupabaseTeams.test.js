import { withCurrentSeasonName } from "./useSupabaseTeams";

test("shows every team's current seasonal name while preserving its legacy name", () => {
  const team = { id: "team-1", name: "A-pojk", legacyName: "A-pojk" };
  const seasons = [
    { season_name: "2026/2027", display_name: "P12" },
    { season_name: "Historik före säsongsindelning", display_name: "A-pojk" }
  ];

  expect(withCurrentSeasonName(team, seasons, "2026/2027")).toEqual({
    id: "team-1",
    name: "P12",
    legacyName: "A-pojk"
  });
});
