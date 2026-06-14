#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const FACIT_FILES = [
  ["P19 R\u00f6d", "Profixio_P19_Rod.xlsx", "BK Heid R\u00f6d"],
  ["P16 R\u00f6d", "Profixio_P16_Rod.xlsx", "BK Heid R\u00f6d"],
  ["P16 Svart", "Profixio_P16_Svart.xlsx", "BK Heid Svart"],
];

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
      throw new Error(`Okant argument: ${arg}`);
    }
  }
  if (!options.root) {
    throw new Error("Ange arbetsmappen med --root.");
  }
  options.root = path.resolve(options.root);
  options.output = path.resolve(options.output || path.join(options.root, "Sorterade"));
  return options;
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bhandboll\b/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function meaningfulTeamWords(value) {
  return normalize(value)
    .split(" ")
    .map((word) => {
      if (word === "rik") return "redbergslid";
      if (word === "hallly") return "hallby";
      return word.replace(/^redbergslids$/, "redbergslid");
    })
    .filter(
      (word) =>
        word &&
        !["hk", "bk", "hf", "if", "ik"].includes(word) &&
        !/^\d+$/.test(word) &&
        !/^p\d+(?:-\d+)?$/.test(word),
    );
}

function namesAreCompatible(left, right) {
  const leftWords = meaningfulTeamWords(left);
  const rightWords = meaningfulTeamWords(right);
  if (!leftWords.length || !rightWords.length) return false;
  const overlap = leftWords.filter((word) => rightWords.includes(word));
  return overlap.length >= Math.min(leftWords.length, rightWords.length);
}

function parseScore(value) {
  const match = String(value || "").match(/(\d+)\s*[-\u2013]\s*(\d+)/);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

function scoresEqual(left, right) {
  return left && right && left[0] === right[0] && left[1] === right[1];
}

function listFiles(directory, excludedDirectory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (fullPath === excludedDirectory) continue;
    if (entry.isDirectory()) {
      if (entry.name !== "Profixio_facit") {
        files.push(...listFiles(fullPath, excludedDirectory));
      }
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".xlsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

function readRows(file) {
  const workbook = XLSX.readFile(file, { cellDates: true });
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: null,
      raw: false,
    });
    if (rows.length) return rows;
  }
  return [];
}

function parseMatchFile(file) {
  let rows;
  try {
    rows = readRows(file);
  } catch (error) {
    return { file, error: error.message };
  }
  const header = String(rows[0]?.[0] || "");
  const match = header.match(
    /Cup:\s*(.*?)\s*\|\s*Match:\s*(\d{4}-\d{2}-\d{2})\s*\|\s*Motst(?:a|\u00e5)ndare:\s*(.*?)\s*\|\s*Plats:\s*(.*?)\s*\|\s*Slutresultat:\s*(\d+)\s*[-\u2013]\s*(\d+)/i,
  );
  if (!match) return null;
  return {
    file,
    cup: match[1],
    date: match[2],
    opponent: match[3],
    place: match[4],
    score: [Number(match[5]), Number(match[6])],
  };
}

function readFacit(root) {
  const facitDirectory = path.join(root, "Profixio_facit");
  return FACIT_FILES.flatMap(([team, filename, ownTeam]) => {
    const file = path.join(facitDirectory, filename);
    const rows = readRows(file);
    return rows.slice(1).map((row) => {
      const [matchNumber, , date, , competition, homeTeam, scoreValue, awayTeam] = row;
      const homeAwayScore = parseScore(scoreValue);
      const ownTeamIsHome = namesAreCompatible(homeTeam, ownTeam);
      return {
        id: String(matchNumber || "").replace(/\s+/g, ""),
        team,
        competition: String(competition || "").trim(),
        date: String(date || "").slice(0, 10),
        ownTeam,
        opponent: ownTeamIsHome ? awayTeam : homeTeam,
        score: ownTeamIsHome && homeAwayScore ? homeAwayScore : homeAwayScore?.slice().reverse(),
      };
    });
  });
}

function hashFile(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function relative(root, file) {
  return path.relative(root, file);
}

function uniqueTarget(directory, sourceFile) {
  const extension = path.extname(sourceFile);
  const basename = path.basename(sourceFile, extension);
  let candidate = path.join(directory, `${basename}${extension}`);
  let number = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, `${basename} (${number})${extension}`);
    number += 1;
  }
  return candidate;
}

function copyFile(source, directory, dryRun) {
  if (dryRun) return path.join(directory, path.basename(source));
  fs.mkdirSync(directory, { recursive: true });
  const target = uniqueTarget(directory, source);
  fs.copyFileSync(source, target);
  return target;
}

function toCsv(rows) {
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const fields = ["status", "team", "matchId", "date", "opponent", "score", "source", "sha256"];
  return [
    fields.map(escape).join(","),
    ...rows.map((row) => fields.map((field) => escape(row[field])).join(",")),
  ].join("\n");
}

function main() {
  const options = parseArgs(process.argv);
  const facit = readFacit(options.root);
  const scannedFiles = listFiles(options.root, options.output);
  const parsedFiles = scannedFiles.map(parseMatchFile).filter(Boolean);
  const errors = parsedFiles.filter((file) => file.error);
  const matchFiles = parsedFiles.filter((file) => !file.error);
  const grouped = new Map();
  const unmatched = [];
  const ambiguous = [];
  const needsReview = [];

  for (const file of matchFiles) {
    const candidates = facit.filter(
      (entry) =>
        entry.date === file.date &&
        scoresEqual(entry.score, file.score) &&
        namesAreCompatible(entry.opponent, file.opponent),
    );
    if (candidates.length === 1) {
      const candidate = candidates[0];
      const files = grouped.get(candidate.id) || [];
      files.push({ ...file, facit: candidate, sha256: hashFile(file.file) });
      grouped.set(candidate.id, files);
    } else if (candidates.length > 1) {
      ambiguous.push({ ...file, candidates });
    } else {
      const possibleCandidates = facit.filter(
        (entry) =>
          entry.date === file.date &&
          (scoresEqual(entry.score, file.score) || namesAreCompatible(entry.opponent, file.opponent)),
      );
      if (possibleCandidates.length) {
        needsReview.push({ ...file, candidates: possibleCandidates });
      } else {
        unmatched.push(file);
      }
    }
  }

  const rows = [];
  for (const files of grouped.values()) {
    files.sort((left, right) => left.file.length - right.file.length || left.file.localeCompare(right.file));
    files.forEach((file, index) => {
      const status = index === 0 ? "seriespel" : "kanske_dubblett";
      const directory =
        index === 0
          ? path.join(options.output, file.facit.team, "Seriespel")
          : path.join(options.output, "Kanske dubletter", file.facit.team);
      copyFile(file.file, directory, options.dryRun);
      rows.push({
        status,
        team: file.facit.team,
        matchId: file.facit.id,
        date: file.date,
        opponent: file.opponent,
        score: file.score.join("-"),
        source: relative(options.root, file.file),
        sha256: file.sha256,
      });
    });
  }

  for (const file of needsReview) {
    const directory = path.join(options.output, "Behöver granskas");
    copyFile(file.file, directory, options.dryRun);
    rows.push({
      status: "behover_granskas",
      team: file.candidates.map((candidate) => candidate.team).join(" / "),
      matchId: file.candidates.map((candidate) => candidate.id).join(" / "),
      date: file.date,
      opponent: file.opponent,
      score: file.score.join("-"),
      source: relative(options.root, file.file),
      sha256: hashFile(file.file),
    });
  }

  const matchedIds = new Set(grouped.keys());
  const missingFacit = facit.filter((entry) => !matchedIds.has(entry.id));
  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: options.dryRun,
    summary: {
      scannedXlsxFiles: scannedFiles.length,
      readableMatchFiles: matchFiles.length,
      seriesMatchesCopied: rows.filter((row) => row.status === "seriespel").length,
      possibleDuplicatesCopied: rows.filter((row) => row.status === "kanske_dubblett").length,
      possibleSeriesFilesToReview: needsReview.length,
      unmatchedMatchFiles: unmatched.length,
      ambiguousMatchFiles: ambiguous.length,
      facitMatchesWithoutFile: missingFacit.length,
      unreadableFiles: errors.length,
    },
    sortedFiles: rows,
    filesToReview: needsReview.map((file) => ({
      source: relative(options.root, file.file),
      fileData: {
        date: file.date,
        opponent: file.opponent,
        score: file.score,
      },
      possibleFacitMatches: file.candidates,
    })),
    unmatchedFiles: unmatched.map((file) => ({
      source: relative(options.root, file.file),
      date: file.date,
      opponent: file.opponent,
      score: file.score,
    })),
    ambiguousFiles: ambiguous.map((file) => ({
      source: relative(options.root, file.file),
      candidateMatchIds: file.candidates.map((candidate) => candidate.id),
    })),
    facitMatchesWithoutFile: missingFacit,
    unreadableFiles: errors.map((file) => ({ source: relative(options.root, file.file), error: file.error })),
  };

  if (!options.dryRun) {
    fs.mkdirSync(options.output, { recursive: true });
    fs.writeFileSync(path.join(options.output, "sorteringsrapport.json"), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(options.output, "sorteringsrapport.csv"), `${toCsv(rows)}\n`);
  }

  console.log(JSON.stringify(report, null, 2));
}

main();
