export const APP_STATE_KEY = "handbollsstat-state";
export const SEASON_STATE_KEY = "handbollsstat-season";
export const SELECTED_TEAM_KEY = "handbollsstat-selectedTeamId";

export const TEAM_IDS = ["p13-14", "p16-19"];

export const loadSaved = () => {
  try {
    return JSON.parse(localStorage.getItem(APP_STATE_KEY)) || null;
  } catch {
    return null;
  }
};

export const loadSeasonMatches = () => {
  try {
    return JSON.parse(localStorage.getItem(SEASON_STATE_KEY)) || [];
  } catch {
    return [];
  }
};

export const n = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

export const emptyCounters = () => ({
  goal: 0,
  save: 0,
  miss: 0,
  post: 0,
  sevenGoal: 0,
  sevenMiss: 0,
  twoMin: 0,
  redCard: 0,
  yellowCard: 0,
  gkScored: 0,
  assist: 0,
  turnover: 0,
  byHalf: { 1: {}, 2: {} }
});

export const eventLabel = (type, player) => {
  if (player?.role === "goalkeeper" && type === "goal") return "Insläppt";

  switch (type) {
    case "goal":
      return "Mål";
    case "save":
      return "Räddning";
    case "miss":
      return "Utanför";
    case "post":
      return "Ribba";
    case "sevenGoal":
      return "7m Mål";
    case "sevenMiss":
      return "7m Miss";
    case "twoMin":
      return "2 min";
    case "redCard":
      return "Rött";
    case "yellowCard":
      return "Gult";
    case "gkScored":
      return "MV mål";
    case "assist":
      return "Assist";
    case "turnover":
      return "Tekniskt";
    default:
      return type;
  }
};

export function getTeamFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search);
    const teamId = (params.get("team") || "").toLowerCase();
    return TEAM_IDS.includes(teamId) ? teamId : null;
  } catch {
    return null;
  }
}

export function clearTeamQueryParam() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("team");
    window.history.replaceState({}, "", url.toString());
  } catch {}
}

export const filterSeasonMatchesByTeam = (seasonMatches, selectedTeamId) =>
  selectedTeamId
    ? seasonMatches.filter((match) => match.teamId === selectedTeamId)
    : seasonMatches;

const keyForPlayer = (player) =>
  `${player.role || "field"}:${Number(player.nr)}:${(player.name || "").trim()}`;

const resolvePlayersInMatch = (match, teamsData) => {
  let playersInMatch = Array.isArray(match.playerRoster) ? match.playerRoster : [];

  if (
    playersInMatch.length === 0 &&
    Array.isArray(match.selectedPlayers) &&
    typeof match.selectedPlayers[0] === "object"
  ) {
    playersInMatch = match.selectedPlayers;
  }

  if (playersInMatch.length === 0 && Array.isArray(match.selectedPlayers)) {
    const team = teamsData.find((item) => item.id === match.teamId);
    const basePlayers = Array.isArray(team?.players) ? team.players : [];
    const playerByNr = new Map(basePlayers.map((player) => [String(player.nr), player]));
    playersInMatch = match.selectedPlayers
      .map((nr) => {
        const player = playerByNr.get(String(nr));
        return {
          nr: Number(nr),
          name: player?.name || "",
          role: player?.role === "goalkeeper" ? "goalkeeper" : undefined
        };
      })
      .filter((player) => Number.isFinite(Number(player.nr)));
  }

  return playersInMatch;
};

export const buildSeasonSummary = (matches, teamsData) => {
  const byPlayer = new Map();

  const getRow = (player) => {
    const key = keyForPlayer(player);
    if (!byPlayer.has(key)) {
      byPlayer.set(key, {
        key,
        nr: player.nr,
        name: player.name || "",
        role: player.role || "field",
        matches: 0,

        // Raw counters (match stats)
        goal: 0,
        save: 0,
        miss: 0,
        post: 0,
        sevenGoal: 0,
        sevenMiss: 0,
        twoMin: 0,
        yellowCard: 0,
        redCard: 0,
        gkScored: 0,
        assist: 0,
        turnover: 0,

        // Derived totals
        goals: 0, // total goals incl 7m
        sevenGoals: 0,
        sevenAttempts: 0,
        attempts: 0, // shots/attempts definition

        // Goalkeeper aggregates
        gkSaves: 0,
        gkConceded: 0,
        gkShotsFaced: 0
      });
    }
    return byPlayer.get(key);
  };

  matches.forEach((match) => {
    const playersInMatch = resolvePlayersInMatch(match, teamsData);
    const statsObj = match.stats || {};

    playersInMatch.forEach((player) => {
      const row = getRow(player);
      row.matches += 1;

      const playerStats = statsObj?.[player.nr] || statsObj?.[String(player.nr)] || {};

      // Aggregate raw counters (works for both roles; meaning differs for GK on some fields)
      const cGoal = n(playerStats.goal);
      const cSave = n(playerStats.save);
      const cMiss = n(playerStats.miss);
      const cPost = n(playerStats.post);
      const cSevenGoal = n(playerStats.sevenGoal);
      const cSevenMiss = n(playerStats.sevenMiss);
      const cTwoMin = n(playerStats.twoMin);
      const cYellow = n(playerStats.yellowCard);
      const cRed = n(playerStats.redCard);
      const cGkScored = n(playerStats.gkScored);
      const cAssist = n(playerStats.assist);
      const cTurnover = n(playerStats.turnover);

      row.goal += cGoal;
      row.save += cSave;
      row.miss += cMiss;
      row.post += cPost;
      row.sevenGoal += cSevenGoal;
      row.sevenMiss += cSevenMiss;
      row.twoMin += cTwoMin;
      row.yellowCard += cYellow;
      row.redCard += cRed;
      row.gkScored += cGkScored;
      row.assist += cAssist;
      row.turnover += cTurnover;

      if (row.role === "goalkeeper") {
        // In GK stats: `goal` is conceded, `save` is saves, `sevenMiss` is 7m saves.
        const gkSaves = cSave + cSevenMiss;
        const gkConceded = cGoal + cSevenGoal;
        const gkShotsFaced = gkSaves + gkConceded;

        row.gkSaves += gkSaves;
        row.gkConceded += gkConceded;
        row.gkShotsFaced += gkShotsFaced;

        // Keep derived fields consistent
        row.goals += cGkScored;
      } else {
        // Field player derived totals
        const totalGoals = cGoal + cSevenGoal;
        const attempts = cGoal + cSevenGoal + cMiss + cPost + cSevenMiss + cSave;

        row.goals += totalGoals;
        row.sevenGoals += cSevenGoal;
        row.sevenAttempts += cSevenGoal + cSevenMiss;
        row.attempts += attempts;
      }
    });
  });

  const all = Array.from(byPlayer.values());
  const fieldPlayers = all
    .filter((row) => row.role !== "goalkeeper")
    .sort((a, b) => n(a.nr) - n(b.nr));

  const goalkeepers = all
    .filter((row) => row.role === "goalkeeper")
    .sort((a, b) => n(a.nr) - n(b.nr));

  return { fieldPlayers, goalkeepers, matchCount: matches.length };
};

export const buildSeasonKpis = (matches, fieldPlayers) => {
  let ourGoals = 0;
  let oppGoals = 0;

  matches.forEach((match) => {
    const result = match.result || {};
    const isHomeMatch = (match.matchInfo?.location || "") === "Hemma";
    if (isHomeMatch) {
      ourGoals += n(result.home);
      oppGoals += n(result.away);
    } else {
      ourGoals += n(result.away);
      oppGoals += n(result.home);
    }
  });

  const top3 = [...fieldPlayers]
    .sort((a, b) => n(b.goals) - n(a.goals))
    .slice(0, 3);

  return {
    matchCount: matches.length,
    ourGoals,
    oppGoals,
    top3
  };
};

export const sortPlayersForUI = (players) =>
  [...players].sort((a, b) => {
    const aGK = a.role === "goalkeeper" ? -1 : 1;
    const bGK = b.role === "goalkeeper" ? -1 : 1;
    if (aGK !== bGK) return aGK - bGK;
    return Number(a.nr) - Number(b.nr);
  });
