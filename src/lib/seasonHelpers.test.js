import { getCurrentSeasonDefinition, getLatestSeasonBefore } from "./seasonHelpers";

test("changes season on June 1", () => {
  expect(getCurrentSeasonDefinition(new Date(2027, 4, 31, 12))).toEqual({
    name: "2026/2027",
    startsOn: "2026-06-01",
    endsOn: "2027-05-31"
  });
  expect(getCurrentSeasonDefinition(new Date(2027, 5, 1, 12))).toEqual({
    name: "2027/2028",
    startsOn: "2027-06-01",
    endsOn: "2028-05-31"
  });
});

test("uses the latest earlier season as roster source", () => {
  const seasons = [
    { team_season_id: "old", season_name: "Historik före säsongsindelning", starts_on: "1900-01-01" },
    { team_season_id: "latest", season_name: "2025/2026", starts_on: "2025-06-01" },
    { team_season_id: "current", season_name: "2026/2027", starts_on: "2026-06-01" }
  ];

  expect(getLatestSeasonBefore(seasons, "2026/2027")?.team_season_id).toBe("latest");
});
