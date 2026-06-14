#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const TEAMS = ["P16 Röd", "P16 Svart", "P19 Röd"];
const DEFAULT_TEAM_ID = "Herrjuniorer";
const DEFAULT_SEASON = "HJ 2025/2026";
const TEAM_PATH_OVERRIDES = [
  {
    pattern: /P16 Svart[\/\\]Cuper[\/\\]Bohus Cup 2026/i,
    team: "P19 Röd",
  },
  {
    pattern: /Rødspætte Cup 2026[\/\\]Heid 1/i,
    team: "P16 Röd",
    category: "Cup",
    competition: "Rødspætte Cup 2026 Heid 1",
  },
  {
    pattern: /Rødspætte Cup 2026[\/\\]Heid 2/i,
    team: "P16 Svart",
    category: "Cup",
    competition: "Rødspætte Cup 2026 Heid 2",
  },
];
const CANONICAL_NAMES = new Map(
  [
    ["Bertil Almen", "Bertil Almeen"],
    ["Bertil Almeen", "Bertil Almeen"],
    ["Hugo Rommeborn", "Hugo Romeborn"],
    ["Hugo Romeborn", "Hugo Romeborn"],
    ["Johan Lundström", "John Sundqvist Lundström"],
    ["John Lundström", "John Sundqvist Lundström"],
    ["John Sundqvist Lundström", "John Sundqvist Lundström"],
    ["Lucas Cvetkovski", "Lucas Cvetkovski"],
    ["Lukas Cvetkovski", "Lucas Cvetkovski"],
    ["Noel Sölvessvall Kanevik", "Noel Sölvesvall Kanvik"],
    ["Noel Sölvesvall", "Noel Sölvesvall Kanvik"],
    ["Noel Sölvesvall K", "Noel Sölvesvall Kanvik"],
    ["Noel Sölvesvall Kanevik", "Noel Sölvesvall Kanvik"],
    ["Noel Sölvesvall Kanvik", "Noel Sölvesvall Kanvik"],
    ["Noel Nicklasson", "Noel Niklasson"],
    ["Noel Niklasson", "Noel Niklasson"],
  ].map(([from, to]) => [from.normalize("NFC"), to.normalize("NFC")]),
);

function parseArgs(argv) {
  const options = { dryRun: false };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--root" || arg === "--output") {
      options[arg.slice(2)] = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Okänt argument: ${arg}`);
    }
  }
  if (!options.root) throw new Error("Ange --root, till exempel /Users/.../Matchannalys/Sorterade");
  options.root = path.resolve(options.root);
  options.output = path.resolve(options.output || path.join(options.root, "MatchApp JSON"));
  return options;
}

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function stripDiacritics(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function slug(value) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeName(value) {
  const cleanName = String(value || "")
    .normalize("NFC")
    .replace(/\s*\(MV\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return CANONICAL_NAMES.get(cleanName) || cleanName;
}

function nameKey(value) {
  return slug(normalizeName(value));
}

function emptyCounters() {
  return {
    goal: 0,
    miss: 0,
    post: 0,
    save: 0,
    assist: 0,
    sevenGoal: 0,
    sevenMiss: 0,
    twoMin: 0,
    yellowCard: 0,
    redCard: 0,
    gkScored: 0,
    turnover: 0,
  };
}

function withHalves(stats) {
  return {
    ...emptyCounters(),
    ...stats,
    byHalf: {
      1: { ...emptyCounters(), ...(stats.byHalf?.[1] || {}) },
      2: { ...emptyCounters(), ...(stats.byHalf?.[2] || {}) },
    },
  };
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const normalized = String(value).replace(",", ".").trim();
  if (!normalized || normalized === "-") return 0;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function parseScore(value) {
  const match = String(value || "").match(/(\d+)\s*[-–]\s*(\d+)/);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

function parseTopLine(line) {
  const text = String(line || "").normalize("NFC");
  const fields = {};
  for (const part of text.split("|")) {
    const [rawKey, ...rest] = part.split(":");
    if (!rest.length) continue;
    const key = rawKey.trim().toLowerCase();
    fields[key] = rest.join(":").trim();
  }
  const cup = fields.cup === "-" ? "" : fields.cup || "";
  const cupMatch = cup.match(/^(.*?)\s*\((.*?)\)\s*$/);
  const rawMatch = fields.match && fields.match !== "-" ? fields.match : "";
  const rawPlace = fields.plats && fields.plats !== "-" ? fields.plats : "";
  const compactDate = rawMatch.match(/^(\d{4})(\d{2})(\d{2})$/);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawMatch)
    ? rawMatch
    : compactDate
      ? `${compactDate[1]}-${compactDate[2]}-${compactDate[3]}`
      : fields.datum || "";
  const location = /^(Hemma|Borta)$/i.test(rawPlace)
    ? rawPlace
    : /^(Hemma|Borta)$/i.test(rawMatch)
      ? rawMatch
      : rawPlace;
  return {
    cupName: cupMatch ? cupMatch[1].trim() : cup,
    cupPhase: cupMatch ? cupMatch[2].trim() : "",
    date,
    opponent: fields["motståndare"] && fields["motståndare"] !== "-" ? fields["motståndare"] : "",
    location,
    score: parseScore(fields.slutresultat),
  };
}

function sectionBounds(rows, titlePattern) {
  const start = rows.findIndex((row) => titlePattern.test(String(row[0] || "")));
  const fallbackHeader = rows.findIndex((row) => String(row[0] || "") === "Nummer" && String(row[1] || "") === "Namn");
  if (start < 0) {
    return fallbackHeader < 0 ? null : { header: fallbackHeader, end: rows.length };
  }
  const header = rows.findIndex((row, index) => index > start && String(row[0] || "") === "Nummer");
  if (header < 0) return null;
  const next = rows.findIndex(
    (row, index) =>
      index > header &&
      (/^\d+:[a-zåäö ]+halvlek/i.test(String(row[0] || "")) ||
        /^Lagstatistik$/i.test(String(row[0] || "")) ||
        /^RESULTAT/i.test(String(row[0] || ""))),
  );
  return { header, end: next < 0 ? rows.length : next };
}

function rowToStats(row, isGoalkeeper, layout = "current") {
  if (layout === "legacy") {
    if (isGoalkeeper) {
      return {
        ...emptyCounters(),
        goal: parseNumber(row[3]),
        save: parseNumber(row[4]),
        miss: parseNumber(row[5]),
        post: parseNumber(row[6]),
        sevenGoal: parseNumber(row[9]),
        sevenMiss: parseNumber(row[10]),
      };
    }
    return {
      ...emptyCounters(),
      goal: parseNumber(row[2]),
      save: parseNumber(row[4]),
      miss: parseNumber(row[5]),
      post: parseNumber(row[6]),
      sevenGoal: parseNumber(row[7]),
      sevenMiss: parseNumber(row[8]),
    };
  }
  if (isGoalkeeper) {
    return {
      ...emptyCounters(),
      goal: parseNumber(row[3]),
      save: parseNumber(row[4]),
      miss: parseNumber(row[5]),
      post: parseNumber(row[6]),
      assist: parseNumber(row[7]),
      sevenGoal: parseNumber(row[8]),
      sevenMiss: parseNumber(row[9]),
      gkScored: parseNumber(row[14]),
      twoMin: parseNumber(row[15]),
      yellowCard: parseNumber(row[16]),
      redCard: parseNumber(row[17]),
    };
  }
  return {
    ...emptyCounters(),
    goal: parseNumber(row[2]),
    save: parseNumber(row[4]),
    miss: parseNumber(row[5]),
    post: parseNumber(row[6]),
    assist: parseNumber(row[7]),
    sevenGoal: parseNumber(row[12]),
    sevenMiss: parseNumber(row[13]),
    twoMin: parseNumber(row[15]),
    yellowCard: parseNumber(row[16]),
    redCard: parseNumber(row[17]),
  };
}

function readRows(file) {
  const workbook = XLSX.readFile(file, { cellDates: false });
  const sheet = workbook.Sheets.Statistik || workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
}

function addStats(target, source) {
  for (const key of Object.keys(emptyCounters())) {
    target[key] = (target[key] || 0) + (source[key] || 0);
  }
}

function parseExcelMatch(file, team, category, competition) {
  const rows = readRows(file);
  const top = parseTopLine((rows[0] || []).join(" | "));
  if (!top.date || !top.opponent || !top.score) {
    throw new Error("saknar datum, motståndare eller slutresultat");
  }

  const totalBounds = sectionBounds(rows, /^HELA MATCHEN/i);
  if (!totalBounds) throw new Error("hittar inte HELA MATCHEN-tabellen");
  const headerRow = rows[totalBounds.header] || [];
  const layout = String(headerRow[3] || "").includes("Insläppta") ? "legacy" : "current";

  const players = new Map();
  const registerRows = (bounds, half = null) => {
    if (!bounds) return;
    for (let index = bounds.header + 1; index < bounds.end; index += 1) {
      const row = rows[index] || [];
      const rawName = normalizeName(row[1]);
      if (!rawName || /^SUMMA|^RESULTAT|^Lagstatistik|^Namn$/i.test(rawName)) continue;
      const nr = row[0];
      if (nr === "" || rawName === "0") continue;
      const isGoalkeeper = /\(MV\)/i.test(String(row[1] || "")) || (layout === "legacy" && row[3] !== "");
      const id = nameKey(rawName);
      if (!id) continue;
      if (!players.has(id)) {
        players.set(id, {
          id,
          playerId: id,
          nr: Number(nr),
          shirtNumber: Number(nr),
          name: rawName,
          role: isGoalkeeper ? "goalkeeper" : undefined,
          stats: withHalves({}),
        });
      }
      const player = players.get(id);
      if (isGoalkeeper) player.role = "goalkeeper";
      const stats = rowToStats(row, player.role === "goalkeeper", layout);
      if (half) {
        addStats(player.stats.byHalf[half], stats);
      } else {
        for (const key of Object.keys(emptyCounters())) player.stats[key] = stats[key] || 0;
      }
    }
  };

  registerRows(totalBounds, null);
  registerRows(sectionBounds(rows, /^1:a HALVLEK/i), 1);
  registerRows(sectionBounds(rows, /^2:a HALVLEK/i), 2);

  const isCup = category !== "Seriespel";
  const matchType = isCup ? "cup" : "series";
  const cupName = isCup ? top.cupName || competition || category : "";
  const cupPhase = isCup ? top.cupPhase || competition.replace(/^.*?Steg\s*/i, "Steg ").trim() : "";
  const isHome = top.location === "Hemma";
  const [ownGoals, oppGoals] = top.score;
  const result = isHome ? { home: ownGoals, away: oppGoals } : { home: oppGoals, away: ownGoals };
  const playerRoster = [...players.values()]
    .map(({ stats, ...player }) => player)
    .sort((left, right) => (left.role === "goalkeeper" ? -1 : 1) - (right.role === "goalkeeper" ? -1 : 1) || left.name.localeCompare(right.name, "sv"));
  const stats = Object.fromEntries([...players.entries()].map(([id, player]) => [id, player.stats]));
  const stable = `${team}|${category}|${competition}|${top.date}|${top.opponent}|${top.location}|${ownGoals}-${oppGoals}`;
  return {
    id: crypto.createHash("sha1").update(stable).digest("hex"),
    createdAt: new Date("2026-06-09T00:00:00.000Z").toISOString(),
    teamId: DEFAULT_TEAM_ID,
    teamName: team,
    season: DEFAULT_SEASON,
    matchInfo: {
      date: top.date,
      location: top.location,
      opponent: top.opponent,
      season: DEFAULT_SEASON,
    },
    matchType,
    cupName,
    cupPhase,
    result,
    selectedPlayers: playerRoster.map((player) => player.id),
    playerRoster,
    stats,
    history: [],
    importMeta: {
      sourceFile: file,
      category,
      competition,
    },
  };
}

function loadJsonMatches(file, team, category, competition) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const matches = Array.isArray(data.matches) ? data.matches : [];
  return matches.map((match) => normalizeImportedMatch({
    ...match,
    teamId: DEFAULT_TEAM_ID,
    teamName: team,
    season: match.season || match.matchInfo?.season || DEFAULT_SEASON,
    matchInfo: { ...(match.matchInfo || {}), season: match.matchInfo?.season || match.season || DEFAULT_SEASON },
    matchType: match.matchType || (category === "Seriespel" ? "series" : "cup"),
    cupName: match.cupName || (category === "Seriespel" ? "" : competition),
    cupPhase: match.cupPhase || "",
    importMeta: {
      ...(match.importMeta || {}),
      sourceFile: file,
      category,
      competition,
    },
  }));
}

function mergeStats(left = {}, right = {}) {
  const merged = withHalves(left);
  for (const key of Object.keys(emptyCounters())) {
    merged[key] = (merged[key] || 0) + (right[key] || 0);
  }
  for (const half of [1, 2]) {
    const sourceHalf = right.byHalf?.[half] || {};
    for (const key of Object.keys(emptyCounters())) {
      merged.byHalf[half][key] = (merged.byHalf[half][key] || 0) + (sourceHalf[key] || 0);
    }
  }
  return merged;
}

function normalizeImportedMatch(match) {
  const oldStats = match.stats || {};
  const roster = [];
  const stats = {};
  const selectedPlayers = [];
  const refToId = new Map();

  for (const player of match.playerRoster || []) {
    const cleanName = normalizeName(player.name);
    const id = nameKey(cleanName);
    if (!id || !cleanName) continue;
    const normalizedPlayer = {
      ...player,
      id,
      playerId: id,
      nr: Number(player.shirtNumber ?? player.nr),
      shirtNumber: Number(player.shirtNumber ?? player.nr),
      name: cleanName,
      role: player.role === "goalkeeper" ? "goalkeeper" : undefined,
    };
    if (!roster.some((existing) => existing.id === id)) roster.push(normalizedPlayer);
    for (const ref of [player.id, player.playerId, player.nr, player.shirtNumber, id]) {
      if (ref !== undefined && ref !== null && ref !== "") refToId.set(String(ref), id);
    }
  }

  for (const player of roster) {
    selectedPlayers.push(player.id);
    const refs = [player.id, player.playerId, player.nr, player.shirtNumber].map(String);
    const sourceKey = refs.find((ref) => oldStats[ref]);
    if (sourceKey) {
      stats[player.id] = mergeStats(stats[player.id], oldStats[sourceKey]);
    } else {
      stats[player.id] = withHalves({});
    }
  }

  for (const [oldRef, oldValue] of Object.entries(oldStats)) {
    const id = refToId.get(String(oldRef));
    if (id) stats[id] = mergeStats(stats[id], oldValue);
  }

  return {
    ...match,
    selectedPlayers: [...new Set(selectedPlayers)],
    playerRoster: roster,
    stats,
  };
}

function classify(root, file) {
  const relative = path.relative(root, file);
  const parts = relative.split(path.sep);
  const override = TEAM_PATH_OVERRIDES.find((entry) => entry.pattern.test(relative));
  const team = override?.team || TEAMS.find((name) => parts[0] === name);
  if (!team) return null;
  if (/Behöver kompletteras/i.test(relative)) return null;
  if (override?.category) {
    return { team, category: override.category, competition: override.competition || override.category };
  }
  if (parts.includes("Seriespel")) return { team, category: "Seriespel", competition: "Seriespel" };
  const usmIndex = parts.indexOf("USM");
  if (usmIndex >= 0) return { team, category: "USM", competition: parts[usmIndex + 1] || "USM" };
  const cupIndex = parts.indexOf("Cuper");
  if (cupIndex >= 0) return { team, category: "Cup", competition: parts[cupIndex + 1] || "Cup" };
  return null;
}

function similarity(left, right) {
  const a = new Set(nameKey(left).split("-").filter(Boolean));
  const b = new Set(nameKey(right).split("-").filter(Boolean));
  const overlap = [...a].filter((word) => b.has(word)).length;
  return overlap / Math.max(a.size, b.size, 1);
}

function possibleNameDuplicates(matches) {
  const names = new Map();
  for (const match of matches) {
    for (const player of match.playerRoster || []) {
      const key = nameKey(player.name);
      if (!names.has(key)) names.set(key, player.name);
    }
  }
  const unique = [...names.values()].sort((a, b) => a.localeCompare(b, "sv"));
  const pairs = [];
  for (let i = 0; i < unique.length; i += 1) {
    for (let j = i + 1; j < unique.length; j += 1) {
      const score = similarity(unique[i], unique[j]);
      const leftWords = nameKey(unique[i]).split("-").filter(Boolean);
      const rightWords = nameKey(unique[j]).split("-").filter(Boolean);
      const sameFirst = leftWords[0] && leftWords[0] === rightWords[0];
      const closeLast =
        leftWords.at(-1) &&
        rightWords.at(-1) &&
        (leftWords.at(-1).startsWith(rightWords.at(-1)) || rightWords.at(-1).startsWith(leftWords.at(-1)));
      if ((score >= 0.5 || (sameFirst && closeLast)) && nameKey(unique[i]) !== nameKey(unique[j])) {
        pairs.push({ left: unique[i], right: unique[j], score: Number(score.toFixed(2)) });
      }
    }
  }
  return pairs;
}

function ownScore(match) {
  const result = match.result || {};
  if (match.matchInfo?.location === "Hemma") return [result.home, result.away];
  if (match.matchInfo?.location === "Borta") return [result.away, result.home];
  return [result.home, result.away];
}

function matchDedupeKey(match) {
  const [own, opp] = ownScore(match);
  return [
    match.matchInfo?.date || "",
    slug(match.matchInfo?.opponent || ""),
    match.matchInfo?.location || "",
    own ?? "",
    opp ?? "",
  ].join("|");
}

function looseMatchDedupeKey(match) {
  const result = match.result || {};
  const scores = [result.home, result.away].sort((a, b) => Number(a) - Number(b));
  return [match.matchInfo?.date || "", scores[0] ?? "", scores[1] ?? ""].join("|");
}

function sourcePriority(match) {
  const source = match.importMeta?.sourceFile || "";
  if (/\.xlsx$/i.test(source)) return 1;
  if (/\.json$/i.test(source)) return 2;
  return 3;
}

function dedupeMatches(matches) {
  const exact = new Map();
  const loose = new Map();
  const duplicates = [];
  for (const match of matches) {
    const exactKey = matchDedupeKey(match);
    const looseKey = looseMatchDedupeKey(match);
    const existing = exact.get(exactKey) || loose.get(looseKey);
    if (!existing) {
      exact.set(exactKey, match);
      loose.set(looseKey, match);
      continue;
    }
    const keep = sourcePriority(match) < sourcePriority(existing) ? match : existing;
    const drop = keep === match ? existing : match;
    exact.set(matchDedupeKey(keep), keep);
    loose.set(looseMatchDedupeKey(keep), keep);
    duplicates.push({
      kept: keep.importMeta?.sourceFile,
      dropped: drop.importMeta?.sourceFile,
      date: keep.matchInfo?.date,
      opponent: keep.matchInfo?.opponent,
    });
  }
  return { matches: [...new Set([...exact.values()])], duplicates };
}

function build(options) {
  const allFiles = walk(options.root);
  const byTeam = new Map(TEAMS.map((team) => [team, []]));
  const skipped = [];
  const errors = [];

  for (const file of allFiles) {
    const ext = path.extname(file).toLowerCase();
    if (ext === ".numbers") {
      const info = classify(options.root, file);
      if (info) skipped.push({ file, reason: "Numbers kan inte konverteras automatiskt" });
      continue;
    }
    if (![".xlsx", ".json"].includes(ext)) continue;
    if (/alla_matcher\.json$/i.test(path.basename(file))) {
      skipped.push({ file, reason: "samlings-JSON hoppas över för att undvika dubletter" });
      continue;
    }
    const info = classify(options.root, file);
    if (!info) continue;
    try {
      const matches =
        ext === ".json"
          ? loadJsonMatches(file, info.team, info.category, info.competition)
          : [parseExcelMatch(file, info.team, info.category, info.competition)];
      byTeam.get(info.team).push(...matches);
    } catch (error) {
      errors.push({ file, error: error.message });
    }
  }

  const reports = {};
  const duplicates = [];
  for (const team of TEAMS) {
    const deduped = dedupeMatches(byTeam.get(team));
    duplicates.push(...deduped.duplicates.map((entry) => ({ team, ...entry })));
    const matches = deduped.matches.sort((left, right) => {
      const leftDate = left.matchInfo?.date || "";
      const rightDate = right.matchInfo?.date || "";
      return leftDate.localeCompare(rightDate) || (left.matchInfo?.opponent || "").localeCompare(right.matchInfo?.opponent || "", "sv");
    });
    const data = {
      exportedAt: new Date().toISOString(),
      teamId: DEFAULT_TEAM_ID,
      teamName: team,
      matches,
    };
    reports[team] = {
      matches: matches.length,
      possibleNameDuplicates: possibleNameDuplicates(matches),
    };
    if (!options.dryRun) {
      fs.mkdirSync(options.output, { recursive: true });
      fs.writeFileSync(path.join(options.output, `${slug(team)}.json`), `${JSON.stringify(data, null, 2)}\n`);
    }
  }

  return { output: options.output, reports, skipped, duplicates, errors };
}

function main() {
  const options = parseArgs(process.argv);
  const result = build(options);
  console.log(JSON.stringify(result, null, 2));
}

main();
