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

export function pct(numerator, denominator) {
  if (!denominator) return "";
  const value = (numerator / denominator) * 100;
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
}

export const getPlayerId = (player) => player?.id ?? player?.nr;

export const getPlayerShirtNumber = (player) => player?.shirtNumber ?? player?.nr;

export const playerMatchesRef = (player, ref) =>
  String(getPlayerId(player)) === String(ref) || String(player?.nr) === String(ref);

export const getPlayerStats = (statsMap, player) => {
  if (!player) return {};

  const id = getPlayerId(player);
  const idStr = id != null ? String(id) : "";
  const nr = getPlayerShirtNumber(player) ?? player?.nr;
  const nrStr = nr != null ? String(nr) : "";

  if (Array.isArray(statsMap)) {
    const hit =
      (idStr ? statsMap.find((entry) => String(entry?.id ?? "") === idStr) : null) ||
      (idStr ? statsMap.find((entry) => String(entry?.playerId ?? "") === idStr) : null) ||
      (nrStr ? statsMap.find((entry) => String(entry?.nr ?? "") === nrStr) : null);
    return hit?.stats || hit || {};
  }

  const obj = statsMap || {};
  return (
    (id != null ? obj[id] : null) ||
    (idStr ? obj[idStr] : null) ||
    (nrStr ? obj[nrStr] : null) ||
    (obj.players &&
      ((id != null ? obj.players[id] : null) ||
        (idStr ? obj.players[idStr] : null) ||
        (nrStr ? obj.players[nrStr] : null))) ||
    {}
  );
};

export const buildMatchStatRow = (player, statsMap) => {
  const playerId = getPlayerId(player);
  const shirtNumber = getPlayerShirtNumber(player);
  const stats = getPlayerStats(statsMap, player);
  const isGoalkeeper = player?.role === "goalkeeper";

  const goal = n(stats.goal);
  const save = n(stats.save);
  const miss = n(stats.miss);
  const post = n(stats.post);
  const assist = n(stats.assist);
  const turnover = n(stats.turnover);
  const sevenGoal = n(stats.sevenGoal);
  const sevenMiss = n(stats.sevenMiss);
  const twoMin = n(stats.twoMin);
  const yellowCard = n(stats.yellowCard);
  const redCard = n(stats.redCard);
  const gkScored = n(stats.gkScored);

  const gkSaves = save + sevenMiss;
  const gkConceded = goal + sevenGoal;
  const gkShotsFaced = gkSaves + gkConceded;

  const savedShot = n(stats.savedShot ?? stats.saved ?? stats.save ?? stats.blockedShot ?? stats.blocked);
  const attempts = isGoalkeeper ? 0 : goal + sevenGoal + miss + post + sevenMiss + savedShot;
  const goals = isGoalkeeper ? gkScored : goal + sevenGoal;
  const sevenAttempts = sevenGoal + sevenMiss;

  return {
    id: playerId,
    key: `${player?.role || "field"}:${playerId ?? shirtNumber}:${shirtNumber ?? ""}:${(player?.name || "").trim()}`,
    nr: shirtNumber,
    name: player?.name || "",
    role: isGoalkeeper ? "goalkeeper" : "field",
    isGoalkeeper,
    goal,
    save,
    miss,
    wide: miss,
    post,
    assist,
    turnover,
    sevenGoal,
    sevenMiss,
    twoMin,
    suspension: twoMin,
    yellowCard,
    redCard,
    gkScored,
    goals,
    sevenGoals: sevenGoal,
    sevenAttempts,
    attempts,
    gkSaves,
    gkConceded,
    gkShotsFaced,
    savePct: isGoalkeeper ? pct(gkSaves, gkShotsFaced) : "",
    shotPct: isGoalkeeper ? "" : pct(goals, attempts)
  };
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
    playersInMatch = match.selectedPlayers
      .map((ref) => {
        const player = basePlayers.find((item) => playerMatchesRef(item, ref));
        const shirtNumber = getPlayerShirtNumber(player) ?? ref;
        return {
          id: getPlayerId(player) ?? ref,
          nr: Number(shirtNumber),
          shirtNumber: Number(shirtNumber),
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
    const key = `${player.role || "field"}:${getPlayerId(player) ?? getPlayerShirtNumber(player)}`;
    if (!byPlayer.has(key)) {
      byPlayer.set(key, {
        key,
        id: getPlayerId(player),
        nr: getPlayerShirtNumber(player),
        name: player.name || "",
        role: player.role || "field",
        matches: 0,

        goal: 0,
        save: 0,
        miss: 0,
        wide: 0,
        post: 0,
        sevenGoal: 0,
        sevenMiss: 0,
        twoMin: 0,
        suspension: 0,
        yellowCard: 0,
        redCard: 0,
        gkScored: 0,
        assist: 0,
        turnover: 0,

        goals: 0,
        sevenGoals: 0,
        sevenAttempts: 0,
        attempts: 0,

        gkSaves: 0,
        gkConceded: 0,
        gkShotsFaced: 0,
        savePct: "",
        shotPct: ""
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

      const matchRow = buildMatchStatRow(player, statsObj);

      row.goal += matchRow.goal;
      row.save += matchRow.save;
      row.miss += matchRow.miss;
      row.wide += matchRow.miss;
      row.post += matchRow.post;
      row.sevenGoal += matchRow.sevenGoal;
      row.sevenMiss += matchRow.sevenMiss;
      row.twoMin += matchRow.twoMin;
      row.suspension += matchRow.twoMin;
      row.yellowCard += matchRow.yellowCard;
      row.redCard += matchRow.redCard;
      row.gkScored += matchRow.gkScored;
      row.assist += matchRow.assist;
      row.turnover += matchRow.turnover;
      row.goals += matchRow.goals;
      row.sevenGoals += matchRow.sevenGoals;
      row.sevenAttempts += matchRow.sevenAttempts;
      row.attempts += matchRow.attempts;
      row.gkSaves += matchRow.gkSaves;
      row.gkConceded += matchRow.gkConceded;
      row.gkShotsFaced += matchRow.gkShotsFaced;
      row.savePct = row.role === "goalkeeper" ? pct(row.gkSaves, row.gkShotsFaced) : "";
      row.shotPct = row.role === "goalkeeper" ? "" : pct(row.goals, row.attempts);
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
