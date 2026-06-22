import * as XLSX from "xlsx";
import {
  emptyCounters,
  getPlayerId,
  getPlayerShirtNumber,
  getPlayerStats,
  normalizeLegacyGoalkeeperStats
} from "./appHelpers";

export async function exportMatchExcel({
  matchInfo,
  cupEnabled,
  cupPanelOpen,
  cupName,
  cupPhase,
  allPlayers,
  selectedPlayers,
  stats,
  history = []
}) {
  const headers = [
    "Nummer",
    "Namn",
    "Mål",
    "Insl. mål",
    "Räddning",
    "Utanför",
    "Ribba",
    "Assist",
    "7m Insl",
    "7m Räddning",
    "Rädd%",
    "Skott%",
    "7m Mål",
    "7m Miss",
    "MV mål",
    "2 min",
    "Gult",
    "Rött"
  ];

  const findPlayerByRef = (ref) =>
    allPlayers.find((player) => String(getPlayerId(player)) === String(ref)) ||
    allPlayers.find((player) => String(getPlayerShirtNumber(player) ?? player?.nr) === String(ref));

  const sorted = [...selectedPlayers].sort((a, b) => {
    const playerA = findPlayerByRef(a);
    const playerB = findPlayerByRef(b);
    const aIsGk = playerA?.role === "goalkeeper" ? -1 : 1;
    const bIsGk = playerB?.role === "goalkeeper" ? -1 : 1;
    const numCmp =
      Number(getPlayerShirtNumber(playerA) ?? playerA?.nr ?? 0) -
      Number(getPlayerShirtNumber(playerB) ?? playerB?.nr ?? 0);
    return aIsGk - bIsGk || numCmp;
  });

  const getHalfCounters = (playerStats, half) => playerStats?.byHalf?.[half] || emptyCounters();

  const rowsFromStats = (half = null) => {
    const gkRows = [];
    const fieldRows = [];
    let homeGoals = 0;
    let awayGoals = 0;

    sorted.forEach((playerRef) => {
      const player = findPlayerByRef(playerRef);
      if (!player) return;

      const rawPlayerStats = getPlayerStats(stats, player) || {
        ...emptyCounters(),
        byHalf: { 1: emptyCounters(), 2: emptyCounters() }
      };
      const playerStats =
        player?.role === "goalkeeper"
          ? normalizeLegacyGoalkeeperStats(player, rawPlayerStats, history)
          : rawPlayerStats;
      const usedStats = half ? getHalfCounters(playerStats, half) : playerStats;
      const shirtNumber = getPlayerShirtNumber(player) ?? player.nr;

      if (player?.role === "goalkeeper") {
        homeGoals += usedStats.gkScored || 0;
        awayGoals += (usedStats.goal || 0) + (usedStats.sevenGoal || 0);
        const savesTotal = (usedStats.save || 0) + (usedStats.sevenMiss || 0);
        const shotsFaced = (usedStats.goal || 0) + (usedStats.sevenGoal || 0) + savesTotal;
        const savePct =
          shotsFaced > 0 ? `${((savesTotal / shotsFaced) * 100).toFixed(1)}%` : "";

        gkRows.push({
          Nummer: shirtNumber,
          Namn: `${player.name} (MV)`,
          Mål: "",
          "Insl. mål": usedStats.goal || 0,
          Räddning: usedStats.save || 0,
          Utanför: usedStats.miss || 0,
          Ribba: usedStats.post || 0,
          Assist: usedStats.assist || 0,
          "7m Insl": usedStats.sevenGoal || 0,
          "7m Räddning": usedStats.sevenMiss || 0,
          "Rädd%": savePct,
          "7m Mål": "",
          "7m Miss": "",
          "MV mål": usedStats.gkScored || 0,
          "2 min": usedStats.twoMin || 0,
          Gult: usedStats.yellowCard || 0,
          Rött: usedStats.redCard || 0
        });
      } else {
        homeGoals += (usedStats.goal || 0) + (usedStats.sevenGoal || 0);
        fieldRows.push({
          Nummer: shirtNumber,
          Namn: player.name,
          Mål: usedStats.goal || 0,
          "Insl. mål": "",
          Räddning: usedStats.save || 0,
          Utanför: usedStats.miss || 0,
          Ribba: usedStats.post || 0,
          Assist: usedStats.assist || 0,
          "7m Insl": "",
          "7m Räddning": "",
          "Rädd%": "",
          "Skott%": (() => {
            const goals = usedStats.goal || 0;
            const sevenGoals = usedStats.sevenGoal || 0;
            const miss = usedStats.miss || 0;
            const post = usedStats.post || 0;
            const sevenMiss = usedStats.sevenMiss || 0;
            const saved =
              usedStats.savedShot ??
              usedStats.saved ??
              usedStats.save ??
              usedStats.blockedShot ??
              usedStats.blocked ??
              0;
            const attempts = goals + sevenGoals + miss + post + sevenMiss + saved;
            return attempts > 0 ? `${Math.round(((goals + sevenGoals) / attempts) * 100)}%` : "0%";
          })(),
          "7m Mål": usedStats.sevenGoal || 0,
          "7m Miss": usedStats.sevenMiss || 0,
          "MV mål": "",
          "2 min": usedStats.twoMin || 0,
          Gult: usedStats.yellowCard || 0,
          Rött: usedStats.redCard || 0
        });
      }
    });

    const sum = (rows, key) => rows.reduce((total, row) => total + (row[key] || 0), 0);
    const gkAgg = {
      "Insl. mål": sum(gkRows, "Insl. mål"),
      Räddning: sum(gkRows, "Räddning"),
      Utanför: sum(gkRows, "Utanför"),
      Ribba: sum(gkRows, "Ribba"),
      Assist: sum(gkRows, "Assist"),
      "7m Insl": sum(gkRows, "7m Insl"),
      "7m Räddning": sum(gkRows, "7m Räddning"),
      "2 min": sum(gkRows, "2 min"),
      Gult: sum(gkRows, "Gult"),
      Rött: sum(gkRows, "Rött"),
      "MV mål": sum(gkRows, "MV mål")
    };
    const fieldAgg = {
      Mål: sum(fieldRows, "Mål"),
      Räddning: sum(fieldRows, "Räddning"),
      Utanför: sum(fieldRows, "Utanför"),
      Ribba: sum(fieldRows, "Ribba"),
      Assist: sum(fieldRows, "Assist"),
      "7m Mål": sum(fieldRows, "7m Mål"),
      "7m Miss": sum(fieldRows, "7m Miss"),
      "2 min": sum(fieldRows, "2 min"),
      Gult: sum(fieldRows, "Gult"),
      Rött: sum(fieldRows, "Rött")
    };

    return { gkRows, fieldRows, gkAgg, fieldAgg, homeGoals, awayGoals };
  };

  const total = rowsFromStats(null);
  const firstHalf = rowsFromStats(1);
  const secondHalf = rowsFromStats(2);

  const cupActive = (cupEnabled || cupPanelOpen) && (cupName || "").trim();
  const cupLabel = cupActive ? `${cupName.trim()}${cupPhase ? ` (${cupPhase})` : ""}` : "-";
  const topLine = `Cup: ${cupLabel}  |  Match: ${matchInfo.date || "-"}  |  Motståndare: ${
    matchInfo.opponent || "-"
  }  |  Plats: ${matchInfo.location || "-"}  |  Slutresultat: ${total.homeGoals}–${total.awayGoals}`;

  const mapRow = (row) => [
    row.Nummer,
    row.Namn,
    row.Mål,
    row["Insl. mål"],
    row.Räddning,
    row.Utanför,
    row.Ribba,
    row.Assist,
    row["7m Insl"],
    row["7m Räddning"],
    row["Rädd%"],
    row["Skott%"],
    row["7m Mål"],
    row["7m Miss"],
    row["MV mål"],
    row["2 min"],
    row.Gult,
    row.Rött
  ];

  const worksheetData = [
    [topLine],
    [],
    ["HELA MATCHEN"],
    headers,
    ...total.gkRows.map(mapRow),
    [],
    ...total.fieldRows.map(mapRow),
    [],
    [
      "SUMMA (Målvakter)",
      "",
      "",
      total.gkAgg["Insl. mål"],
      total.gkAgg.Räddning,
      total.gkAgg.Utanför,
      total.gkAgg.Ribba,
      total.gkAgg.Assist,
      total.gkAgg["7m Insl"],
      total.gkAgg["7m Räddning"],
      "",
      "",
      "",
      total.gkAgg["MV mål"],
      total.gkAgg["2 min"],
      total.gkAgg.Gult,
      total.gkAgg.Rött
    ],
    [
      "SUMMA (Spelare)",
      "",
      total.fieldAgg.Mål,
      "",
      total.fieldAgg.Räddning,
      total.fieldAgg.Utanför,
      total.fieldAgg.Ribba,
      total.fieldAgg.Assist,
      "",
      "",
      "",
      total.fieldAgg["7m Mål"],
      total.fieldAgg["7m Miss"],
      "",
      total.fieldAgg["2 min"],
      total.fieldAgg.Gult,
      total.fieldAgg.Rött
    ],
    [
      "RESULTAT (Hela matchen)",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      `${total.homeGoals}–${total.awayGoals}`
    ],
    [],
    [],
    [`1:a HALVLEK — Resultat: ${firstHalf.homeGoals}–${firstHalf.awayGoals}`],
    headers,
    ...firstHalf.gkRows.map(mapRow),
    [],
    ...firstHalf.fieldRows.map(mapRow),
    [],
    [`2:a HALVLEK — Resultat: ${secondHalf.homeGoals}–${secondHalf.awayGoals}`],
    headers,
    ...secondHalf.gkRows.map(mapRow),
    [],
    ...secondHalf.fieldRows.map(mapRow)
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  worksheet["!cols"] = [
    { wch: 8 },
    { wch: 24 },
    { wch: 8 },
    { wch: 10 },
    { wch: 10 },
    { wch: 9 },
    { wch: 9 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 8 },
    { wch: 9 },
    { wch: 9 },
    { wch: 10 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 }
  ];

  const helpSheet = XLSX.utils.aoa_to_sheet([
    ["📘 Så får du bandade rader och centrerade siffror i Excel"],
    [""],
    ["1) Markera tabellen (rubrikraden till sista raden)."],
    ["2) Ctrl+T / Cmd+T och välj bandad stil."],
    ["3) Markera Mål–Rött och centrera."]
  ]);
  helpSheet["!cols"] = [{ wch: 110 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Statistik");
  XLSX.utils.book_append_sheet(workbook, helpSheet, "📘 Läs mig");

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  const clean = (value) => (value || "").replace(/[^\p{L}\p{N}\-_ ]/gu, "").trim();
  const cupFilePart = cupActive ? `${cupName.trim()}${cupPhase ? `_${cupPhase}` : ""}` : "";
  const filename = `handbollsstat_${clean(cupFilePart) || "match"}_${
    clean(matchInfo.opponent) || "mot"
  }_${(matchInfo.date || "").replaceAll("-", "") || "datum"}.xlsx`;

  try {
    const file = new File([blob], filename, {
      type: blob.type,
      lastModified: Date.now()
    });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
  } catch {}

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
