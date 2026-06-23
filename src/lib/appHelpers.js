export const APP_STATE_KEY = "handbollsstat-state";
export const SEASON_STATE_KEY = "handbollsstat-season";
export const SELECTED_TEAM_KEY = "handbollsstat-selectedTeamId";
export const SELECTED_SEASON_KEY = "handbollsstat-selectedSeason";

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

export function getSeasonFromDate(dateValue) {
  const match = String(dateValue || "").match(/^(\d{4})-(\d{2})-\d{2}/);
  if (!match) return "";

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return "";

  const startYear = month >= 6 ? year : year - 1;
  return `${startYear}/${startYear + 1}`;
}

export function getDefaultSeason(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const startYear = month >= 6 ? year : year - 1;
  return `${startYear}/${startYear + 1}`;
}

export function normalizeSeason(value) {
  const match = String(value || "").match(/(\d{4})\s*\/\s*(\d{4})/);
  return match ? `${match[1]}/${match[2]}` : String(value || "");
}

export function getMatchSeason(match) {
  return normalizeSeason(match?.season || match?.matchInfo?.season || getSeasonFromDate(match?.matchInfo?.date));
}

export function getSeasonStartYear(season) {
  const year = Number(normalizeSeason(season).split("/")[0]);
  return Number.isFinite(year) ? year : 0;
}

export function buildSeasonOptions(date = new Date()) {
  const currentStartYear = getSeasonStartYear(getDefaultSeason(date));
  const firstStartYear = 2025;
  const seasonCount = Math.max(1, currentStartYear - firstStartYear + 1);

  return Array.from({ length: seasonCount }, (_, index) => {
    const year = firstStartYear + index;
    return `${year}/${year + 1}`;
  });
}

const firstPresent = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

export const getPlayerId = (player) => firstPresent(player?.playerId, player?.id, player?.nr);

export const getPlayerShirtNumber = (player) => firstPresent(player?.shirtNumber, player?.nr);

const getExplicitPlayerId = (player) => firstPresent(player?.playerId, player?.id);

export const playerMatchesRef = (player, ref) =>
  String(getPlayerId(player)) === String(ref) || String(player?.nr) === String(ref);

const normPlayerText = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const sameShirtNumber = (a, b) => {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  return String(a ?? "") === String(b ?? "");
};

export const getPlayerStats = (statsMap, player) => {
  if (!player) return {};

  const id = getPlayerId(player);
  const idStr = id != null ? String(id) : "";
  const nr = getPlayerShirtNumber(player) ?? player?.nr;
  const nrStr = nr != null ? String(nr) : "";
  const statRefs = [
    id,
    player?.playerId,
    player?.id,
    nr,
    player?.shirtNumber,
    player?.nr,
    ...(Array.isArray(player?.statRefs) ? player.statRefs : [])
  ]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map((value) => String(value));
  const uniqueStatRefs = Array.from(new Set(statRefs));

  if (Array.isArray(statsMap)) {
    const hit = uniqueStatRefs
      .map(
        (ref) =>
          statsMap.find((entry) => String(entry?.id ?? "") === ref) ||
          statsMap.find((entry) => String(entry?.playerId ?? "") === ref) ||
          statsMap.find((entry) => String(entry?.nr ?? "") === ref)
      )
      .find(Boolean);
    return hit?.stats || hit || {};
  }

  const obj = statsMap || {};
  for (const ref of uniqueStatRefs) {
    if (obj[ref]) return obj[ref];
    if (obj.players?.[ref]) return obj.players[ref];
  }

  return (
    (id != null ? obj[id] : null) ||
    (idStr ? obj[idStr] : null) ||
    (nrStr ? obj[nrStr] : null) ||
    {}
  );
};

export const normalizeLegacyGoalkeeperStats = (player, stats, history = []) => {
  if (player?.role !== "goalkeeper" || !Array.isArray(history) || history.length === 0) return stats || {};

  const legacyCounts = history.reduce(
    (acc, item) => {
      const matchesRef = (ref) =>
        ref !== undefined && ref !== null && ref !== "" && playerMatchesRef(player, ref);
      if (!matchesRef(item?.playerId) && !matchesRef(item?.nr)) return acc;
      const half = item?.half || 1;
      if (!acc.byHalf[half]) acc.byHalf[half] = { goal: 0, save: 0 };
      if (item?.type === "sevenGoal" && item?.alsoType === "goal") {
        acc.goal += 1;
        acc.byHalf[half].goal += 1;
      }
      if (item?.type === "sevenMiss" && item?.alsoType === "save") {
        acc.save += 1;
        acc.byHalf[half].save += 1;
      }
      return acc;
    },
    { goal: 0, save: 0, byHalf: {} }
  );

  if (!legacyCounts.goal && !legacyCounts.save) return stats || {};

  const nextByHalf = { ...(stats?.byHalf || {}) };
  Object.entries(legacyCounts.byHalf).forEach(([half, counts]) => {
    const halfStats = nextByHalf[half] || {};
    nextByHalf[half] = {
      ...halfStats,
      goal: Math.max(0, n(halfStats.goal) - counts.goal),
      save: Math.max(0, n(halfStats.save) - counts.save)
    };
  });

  return {
    ...(stats || {}),
    goal: Math.max(0, n(stats?.goal) - legacyCounts.goal),
    save: Math.max(0, n(stats?.save) - legacyCounts.save),
    byHalf: nextByHalf
  };
};

export const buildMatchStatRow = (player, statsMap, options = {}) => {
  const playerId = getPlayerId(player);
  const shirtNumber = getPlayerShirtNumber(player);
  const isGoalkeeper = player?.role === "goalkeeper";
  const stats = normalizeLegacyGoalkeeperStats(player, getPlayerStats(statsMap, player), options.history);

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
  if (player?.role === "goalkeeper" && type === "goal") return "Insl. spel";
  if (player?.role === "goalkeeper" && type === "save") return "Rädd spel";
  if (player?.role === "goalkeeper" && type === "sevenGoal") return "7m insläppt";
  if (player?.role === "goalkeeper" && type === "sevenMiss") return "7m rädd";

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

export const filterSeasonMatchesByTeam = (seasonMatches, selectedTeamId, selectedSeason = "") =>
  (seasonMatches || []).filter((match) => {
    const teamMatches = selectedTeamId ? match.teamId === selectedTeamId : true;
    const seasonMatches = selectedSeason ? getMatchSeason(match) === selectedSeason : true;
    return teamMatches && seasonMatches;
  });

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
    const team =
      teamsData.find((item) => item.id === match.teamId) ||
      (teamsData.length === 1 ? teamsData[0] : null);
    const basePlayers = Array.isArray(team?.players) ? team.players : [];
    playersInMatch = match.selectedPlayers
      .map((ref) => {
        const player = basePlayers.find((item) => playerMatchesRef(item, ref));
        const shirtNumber = getPlayerShirtNumber(player) ?? ref;
        const fallbackId = Number.isFinite(Number(ref)) ? undefined : ref;
        return {
          id: getExplicitPlayerId(player) ?? fallbackId,
          nr: Number(shirtNumber),
          shirtNumber: Number(shirtNumber),
          name: player?.name || "",
          role: player?.role === "goalkeeper" ? "goalkeeper" : undefined
        };
      })
      .filter((player) => Number.isFinite(Number(player.nr)));
  }

  const team =
    teamsData.find((item) => item.id === match.teamId) ||
    (teamsData.length === 1 ? teamsData[0] : null);
  const basePlayers = Array.isArray(team?.players) ? team.players : [];
  if (basePlayers.length === 0) return playersInMatch;

  const findCanonicalPlayer = (player) => {
    const playerId = getExplicitPlayerId(player);
    const shirtNumber = getPlayerShirtNumber(player);
    const name = normPlayerText(player?.name);

    const byId = basePlayers.find((item) => {
      const itemId = getExplicitPlayerId(item);
      return playerId != null && playerId !== "" && itemId != null && String(itemId) === String(playerId);
    });
    if (byId) return byId;

    const byNameAndNumber = basePlayers.find(
      (item) =>
        name &&
        normPlayerText(item?.name) === name &&
        sameShirtNumber(getPlayerShirtNumber(item), shirtNumber)
    );
    if (byNameAndNumber) return byNameAndNumber;

    const byName = basePlayers.filter((item) => name && normPlayerText(item?.name) === name);
    return byName.length === 1 ? byName[0] : null;
  };

  return playersInMatch.map((player) => {
    const canonical = findCanonicalPlayer(player);
    if (!canonical) return player;

    const canonicalId = getExplicitPlayerId(canonical);
    const canonicalShirtNumber = getPlayerShirtNumber(canonical);

    return {
      ...player,
      id: canonicalId,
      playerId: canonicalId,
      nr: canonicalShirtNumber,
      shirtNumber: canonicalShirtNumber,
      name: canonical.name || player.name || "",
      role: canonical.role === "goalkeeper" ? "goalkeeper" : player.role,
      statRefs: [
        getPlayerId(player),
        player?.playerId,
        player?.id,
        getPlayerShirtNumber(player),
        player?.shirtNumber,
        player?.nr,
        canonicalId,
        canonicalShirtNumber
      ]
    };
  });
};

export const buildSeasonSummary = (matches, teamsData) => {
  const byPlayer = new Map();

  const getRow = (player) => {
    const explicitId = getExplicitPlayerId(player);
    const normalizedName = normPlayerText(player?.name);
    const identity = explicitId
      ? `id:${explicitId}`
      : normalizedName
        ? `name:${normalizedName}`
        : `number:${getPlayerShirtNumber(player) ?? "unknown"}`;
    const key = `${player.role || "field"}:${identity}`;
    if (!byPlayer.has(key)) {
      byPlayer.set(key, {
        key,
        id: explicitId,
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

      const matchRow = buildMatchStatRow(player, statsObj, { history: match.history || [] });

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
