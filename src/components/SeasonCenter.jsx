import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  buildMatchStatRow,
  buildSeasonKpis as makeSeasonKpis,
  buildSeasonSummary as makeSeasonSummary,
  pct
} from "../lib/appHelpers";

export default function SeasonCenter({
  open,
  selectedTeam,
  selectedSeason,
  seasonOptions = [],
  onSeasonChange,
  seasonKpis,
  onExportBackup,
  onImportBackup,
  onClose,
  seasonSummary,
  matches,
  onDeleteMatch,
  onClearSeason,
  onExportMatchExcel,
  onConfirm,
  canManageSeason = true
}) {
  const [seasonTab, setSeasonTab] = useState("overview");
  const [seasonSearchPlayers, setSeasonSearchPlayers] = useState("");
  const [seasonSearchMatches, setSeasonSearchMatches] = useState("");
  const [showPlayersSearch, setShowPlayersSearch] = useState(false);
  const [showMatchesSearch, setShowMatchesSearch] = useState(false);
  const [seasonDangerOpen, setSeasonDangerOpen] = useState(false);
  const [seasonDangerText, setSeasonDangerText] = useState("");
  const [seasonMatchDetail, setSeasonMatchDetail] = useState(null);
  const [seasonPlayerDetail, setSeasonPlayerDetail] = useState(null);
  const [seasonMatchPlayerFocus, setSeasonMatchPlayerFocus] = useState(null);
  const [seasonScope, setSeasonScope] = useState("all");
  const [matchDeleteMode, setMatchDeleteMode] = useState(false);
  const [selectedMatchIdsForDelete, setSelectedMatchIdsForDelete] = useState([]);
  const importInputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setSeasonTab("overview");
      setSeasonSearchPlayers("");
      setSeasonSearchMatches("");
      setSeasonDangerOpen(false);
      setSeasonDangerText("");
      setSeasonMatchDetail(null);
      setShowPlayersSearch(false);
      setShowMatchesSearch(false);
      setSeasonMatchPlayerFocus(null);
      setSeasonScope("all");
      setMatchDeleteMode(false);
      setSelectedMatchIdsForDelete([]);
    }
  }, [open]);

  // Normalize string: lowercase, trim, collapse spaces, remove accents/diacritics
  const norm = (v) =>
    String(v ?? "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const getOurGoals = (match) => {
    const isAway = String(match?.matchInfo?.location || "").toLowerCase() === "borta";
    const home = Number(match?.result?.home ?? 0);
    const away = Number(match?.result?.away ?? 0);
    return isAway ? away : home;
  };

  const getOppGoals = (match) => {
    const isAway = String(match?.matchInfo?.location || "").toLowerCase() === "borta";
    const home = Number(match?.result?.home ?? 0);
    const away = Number(match?.result?.away ?? 0);
    return isAway ? home : away;
  };

  const getMatchQuickStats = (match) => {
    const roster = Array.isArray(match?.playerRoster) ? match.playerRoster : [];
    const rows = roster.map((player) => buildMatchStatRow(player, match?.stats || {}, { history: match?.history || [] }));
    const fieldRows = rows.filter((row) => !row.isGoalkeeper);
    const goalkeeperRows = rows.filter((row) => row.isGoalkeeper);

    return {
      players: rows.length,
      goals: fieldRows.reduce((sum, row) => sum + (row.goals || 0), 0),
      assists: fieldRows.reduce((sum, row) => sum + (row.assist || 0), 0),
      turnovers: fieldRows.reduce((sum, row) => sum + (row.turnover || 0), 0),
      attempts: fieldRows.reduce((sum, row) => sum + (row.attempts || 0), 0),
      saves: goalkeeperRows.reduce((sum, row) => sum + (row.gkSaves || 0), 0),
      suspensions: rows.reduce((sum, row) => sum + (row.suspension || 0), 0)
    };
  };

  // Clear player search query when search bar closes
  useEffect(() => {
    if (!showPlayersSearch && seasonSearchPlayers) setSeasonSearchPlayers("");
  }, [showPlayersSearch, seasonSearchPlayers]);

  // Clear matches search query when search bar closes
  useEffect(() => {
    if (!showMatchesSearch && seasonSearchMatches) setSeasonSearchMatches("");
  }, [showMatchesSearch, seasonSearchMatches]);

  const scopeOptions = useMemo(() => {
    const cupNames = Array.from(
      new Set(
        (matches || [])
          .filter((m) => m?.matchType === "cup" && String(m?.cupName || "").trim())
          .map((m) => String(m.cupName).trim())
      )
    ).sort((a, b) => a.localeCompare(b, "sv"));

    return [
      { value: "all", label: "Alla matcher" },
      { value: "series", label: "Serie" },
      { value: "cup", label: "Alla cuper" },
      ...cupNames.map((name) => ({ value: `cup:${name}`, label: `🏆 ${name}` }))
    ];
  }, [matches]);

  const scopedMatches = useMemo(() => {
    if (seasonScope === "all") return matches || [];
    if (seasonScope === "series") {
      return (matches || []).filter((m) => (m?.matchType || "series") === "series");
    }
    if (seasonScope === "cup") {
      return (matches || []).filter((m) => m?.matchType === "cup");
    }
    if (seasonScope.startsWith("cup:")) {
      const cupName = seasonScope.slice(4);
      return (matches || []).filter(
        (m) => m?.matchType === "cup" && String(m?.cupName || "").trim() === cupName
      );
    }
    return matches || [];
  }, [matches, seasonScope]);

  const scopedSeasonSummary = useMemo(() => {
    return makeSeasonSummary(scopedMatches || [], selectedTeam ? [selectedTeam] : []);
  }, [scopedMatches, selectedTeam]);

  const scopedSeasonKpis = useMemo(() => {
    return makeSeasonKpis(scopedMatches || [], scopedSeasonSummary.fieldPlayers || []);
  }, [scopedMatches, scopedSeasonSummary.fieldPlayers]);

  const overviewHighlights = useMemo(() => {
    const matchRows = (scopedMatches || []).map((match) => {
      const ourGoals = getOurGoals(match);
      const oppGoals = getOppGoals(match);
      return {
        match,
        ourGoals,
        oppGoals,
        diff: ourGoals - oppGoals,
        label: `${match?.matchInfo?.opponent || "Okänd motståndare"}`,
        meta: `${match?.matchInfo?.date || "-"} • ${match?.matchInfo?.location || "-"}`,
        score: `${ourGoals}–${oppGoals}`
      };
    });

    const bestMatch = [...matchRows].sort((a, b) => b.diff - a.diff || b.ourGoals - a.ourGoals)[0] || null;
    const strongestDefense = [...matchRows].sort((a, b) => a.oppGoals - b.oppGoals || b.diff - a.diff)[0] || null;
    const mostGoals = [...matchRows].sort((a, b) => b.ourGoals - a.ourGoals || b.diff - a.diff)[0] || null;
    const avgGoals = matchRows.length > 0 ? Math.round((matchRows.reduce((sum, row) => sum + row.ourGoals, 0) / matchRows.length) * 10) / 10 : 0;

    return {
      bestMatch,
      strongestDefense,
      mostGoals,
      avgGoals
    };
  }, [scopedMatches]);

  const filteredFieldPlayers = useMemo(() => {
    const query = norm(seasonSearchPlayers);
    return scopedSeasonSummary.fieldPlayers
      .filter((row) => {
        if (!query) return true;
        return String(row.nr).includes(query) || norm(row.name).includes(query);
      })
      .sort((a, b) => {
        const na = Number(a.nr);
        const nb = Number(b.nr);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return String(a.nr).localeCompare(String(b.nr), "sv");
      });
  }, [seasonSearchPlayers, scopedSeasonSummary.fieldPlayers]);

  const filteredGoalkeepers = useMemo(() => {
    const query = norm(seasonSearchPlayers);
    return scopedSeasonSummary.goalkeepers
      .filter((row) => {
        if (!query) return true;
        return String(row.nr).includes(query) || norm(row.name).includes(query);
      })
      .sort((a, b) => {
        const na = Number(a.nr);
        const nb = Number(b.nr);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return String(a.nr).localeCompare(String(b.nr), "sv");
      });
  }, [seasonSearchPlayers, scopedSeasonSummary.goalkeepers]);

  const filteredMatches = useMemo(() => {
    const query = norm(seasonSearchMatches);
    return [...scopedMatches]
      .reverse()
      .filter((match) => {
        if (!query) return true;
        const date = norm(match.matchInfo?.date);
        const opponent = norm(match.matchInfo?.opponent);
        const location = norm(match.matchInfo?.location);
        const score = `${match.result?.home ?? 0}-${match.result?.away ?? 0}`;
        const scoreN = norm(score);
        return (
          date.includes(query) ||
          opponent.includes(query) ||
          location.includes(query) ||
          scoreN.includes(query)
        );
      });
  }, [scopedMatches, seasonSearchMatches]);

  if (!open) return null;

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onImportBackup) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await onImportBackup(data);
    } catch {
      await onImportBackup({ invalid: true });
    }
  };

  return (
    <div className="season-center-shell fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-50">
      <div className="shrink-0 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-slate-500">MatchApp – Säsongscenter</div>
            <div className="text-lg font-extrabold truncate">
              {selectedTeam?.name ? `Säsong: ${selectedTeam.name}` : "Säsong"}
            </div>
            <div className="text-xs text-slate-500">
              {selectedSeason || "Alla säsonger"} • Matcher: {scopedSeasonKpis.matchCount} • Mål: {scopedSeasonKpis.ourGoals} • Insläppta:{" "}
              {scopedSeasonKpis.oppGoals}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {onSeasonChange && (
                <select
                  value={selectedSeason || ""}
                  onChange={(e) => onSeasonChange(e.target.value)}
                  className="border rounded-xl px-3 py-2 text-sm bg-white"
                  title="Välj säsong"
                >
                  {seasonOptions.map((season) => (
                    <option key={season} value={season}>
                      {season}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={seasonScope}
                onChange={(e) => setSeasonScope(e.target.value)}
                className="border rounded-xl px-3 py-2 text-sm bg-white"
              >
                {scopeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onImportBackup && (
              <>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleImportFile}
                />
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-sm font-semibold"
                  title="Importera säsong från JSON"
                >
                  Importera
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onExportBackup}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold"
              title="Ladda ner säsong som JSON"
            >
              ⬇️ Backup
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold"
            >
              Tillbaka
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pb-3">
          <div className="inline-flex rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setSeasonTab("overview")}
              className={`px-4 py-2 rounded-2xl text-sm font-semibold ${
                seasonTab === "overview" ? "bg-white shadow" : "text-slate-700"
              }`}
            >
              Översikt
            </button>
            <button
              type="button"
              onClick={() => setSeasonTab("players")}
              className={`px-4 py-2 rounded-2xl text-sm font-semibold ${
                seasonTab === "players" ? "bg-white shadow" : "text-slate-700"
              }`}
            >
              Spelare
            </button>
            <button
              type="button"
              onClick={() => setSeasonTab("matches")}
              className={`px-4 py-2 rounded-2xl text-sm font-semibold ${
                seasonTab === "matches" ? "bg-white shadow" : "text-slate-700"
              }`}
            >
              Matcher
            </button>
          </div>
        </div>
      </div>

      <div className="season-center-scroll w-full max-w-7xl mx-auto px-4 py-4">
        {seasonTab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white border rounded-2xl p-4">
                <div className="text-xs text-slate-500">Matcher</div>
                <div className="text-3xl font-extrabold">{scopedSeasonKpis.matchCount}</div>
              </div>
              <div className="bg-white border rounded-2xl p-4">
                <div className="text-xs text-slate-500">Mål (för)</div>
                <div className="text-3xl font-extrabold">{scopedSeasonKpis.ourGoals}</div>
              </div>
              <div className="bg-white border rounded-2xl p-4">
                <div className="text-xs text-slate-500">Snitt mål / match</div>
                <div className="text-3xl font-extrabold">{overviewHighlights.avgGoals}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white border rounded-2xl p-4">
                <div className="text-sm font-semibold mb-2">⭐ Bästa match</div>
                {overviewHighlights.bestMatch ? (
                  <>
                    <div className="font-semibold truncate">{overviewHighlights.bestMatch.label}</div>
                    <div className="text-xs text-slate-500">{overviewHighlights.bestMatch.meta}</div>
                    <div className="text-2xl font-extrabold mt-2">{overviewHighlights.bestMatch.score}</div>
                    <div className="text-xs text-slate-500 mt-1">Målskillnad: +{overviewHighlights.bestMatch.diff}</div>
                  </>
                ) : (
                  <div className="text-sm text-slate-500">Inga data ännu.</div>
                )}
              </div>

              <div className="bg-white border rounded-2xl p-4">
                <div className="text-sm font-semibold mb-2">🧱 Starkaste försvar</div>
                {overviewHighlights.strongestDefense ? (
                  <>
                    <div className="font-semibold truncate">{overviewHighlights.strongestDefense.label}</div>
                    <div className="text-xs text-slate-500">{overviewHighlights.strongestDefense.meta}</div>
                    <div className="text-2xl font-extrabold mt-2">{overviewHighlights.strongestDefense.score}</div>
                    <div className="text-xs text-slate-500 mt-1">Insläppta mål: {overviewHighlights.strongestDefense.oppGoals}</div>
                  </>
                ) : (
                  <div className="text-sm text-slate-500">Inga data ännu.</div>
                )}
              </div>

              <div className="bg-white border rounded-2xl p-4">
                <div className="text-sm font-semibold mb-2">🚀 Mest mål i match</div>
                {overviewHighlights.mostGoals ? (
                  <>
                    <div className="font-semibold truncate">{overviewHighlights.mostGoals.label}</div>
                    <div className="text-xs text-slate-500">{overviewHighlights.mostGoals.meta}</div>
                    <div className="text-2xl font-extrabold mt-2">{overviewHighlights.mostGoals.ourGoals}</div>
                    <div className="text-xs text-slate-500 mt-1">Resultat: {overviewHighlights.mostGoals.score}</div>
                  </>
                ) : (
                  <div className="text-sm text-slate-500">Inga data ännu.</div>
                )}
              </div>
            </div>

            {canManageSeason ? (
            <div className="bg-white border border-red-100 rounded-2xl p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-bold text-red-700">Farlig åtgärd</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Rensa tar bort alla sparade matcher för valt lag.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSeasonDangerOpen(true);
                    setSeasonDangerText("");
                  }}
                  className="self-start rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 sm:self-auto"
                  title="Rensa säsong"
                >
                  Rensa säsong
                </button>
              </div>
            </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-bold text-slate-700">Begränsad behörighet</div>
                <div className="mt-1 text-sm text-slate-500">
                  Du kan se säsongen, men endast ägare/admin kan ta bort matcher eller rensa säsongen.
                </div>
              </div>
            )}
          </div>
        )}

        {seasonTab === "players" && (
          <div className="space-y-4">
            <div className="bg-white border rounded-2xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-sm font-semibold">Totalsummering per spelare</div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowPlayersSearch((v) => !v)}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold border border-black/10"
                    aria-label="Sök spelare"
                    title="Sök spelare"
                  >
                    {showPlayersSearch ? "Dölj sök" : "Visa sök"}
                  </button>
                  {showPlayersSearch && (
                    <input
                      type="text"
                      value={seasonSearchPlayers}
                      onChange={(e) => setSeasonSearchPlayers(e.target.value)}
                      placeholder="Sök # eller namn"
                      className="border rounded-xl px-2 py-1 text-sm w-full sm:w-72 h-9"
                      autoFocus
                    />
                  )}
                </div>
              </div>
              {showPlayersSearch && (
                <div className="text-xs text-slate-500 mt-2">Tips: Du kan söka på nummer eller namn.</div>
              )}

              {filteredGoalkeepers.length > 0 && (
                <div className="mt-3">
                  <div className="text-sm font-semibold mb-2">Målvakter</div>
                  <div className="overflow-auto">
                    <table className="w-full text-sm border">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left p-2 border">#</th>
                          <th className="text-left p-2 border">Målvakt</th>
                          <th className="text-right p-2 border">Matcher</th>
                          <th className="text-right p-2 border">Totalt rädd</th>
                          <th className="text-right p-2 border">Rädd spel</th>
                          <th className="text-right p-2 border">Totalt insl</th>
                          <th className="text-right p-2 border">Insl. spel</th>
                          <th className="text-right p-2 border">Rädd%</th>
                          <th className="text-right p-2 border">7m Insl</th>
                          <th className="text-right p-2 border">7m Rädd</th>
                          <th className="text-right p-2 border">MV mål</th>
                          <th className="text-right p-2 border">2 min</th>
                          <th className="text-right p-2 border">Gult</th>
                          <th className="text-right p-2 border">Rött</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredGoalkeepers.map((row) => (
                            <tr
                              key={row.key}
                              onClick={() => setSeasonPlayerDetail({ ...row, type: "gk" })}
                              className="cursor-pointer hover:bg-slate-50"
                            >
                              <td className="p-2 border">{row.nr}</td>
                              <td className="p-2 border">{row.name}</td>
                              <td className="p-2 border text-right">{row.matches}</td>
                              <td className="p-2 border text-right">{row.gkSaves}</td>
                              <td className="p-2 border text-right">{row.save}</td>
                              <td className="p-2 border text-right">{row.gkConceded}</td>
                              <td className="p-2 border text-right">{row.goal}</td>
                              <td className="p-2 border text-right">{row.savePct}</td>
                              <td className="p-2 border text-right">{row.sevenGoal ?? 0}</td>
                              <td className="p-2 border text-right">{row.sevenMiss ?? 0}</td>
                              <td className="p-2 border text-right">{row.gkScored ?? 0}</td>
                              <td className="p-2 border text-right">{row.suspension ?? row.twoMin ?? 0}</td>
                              <td className="p-2 border text-right">{row.yellowCard ?? 0}</td>
                              <td className="p-2 border text-right">{row.redCard ?? 0}</td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="mt-3 overflow-auto">
                <table className="w-full text-sm border">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-2 border">#</th>
                      <th className="text-left p-2 border">Spelare</th>
                      <th className="text-right p-2 border">Matcher</th>
                      <th className="text-right p-2 border">Totalt mål</th>
                      <th className="text-right p-2 border">Spelmål</th>
                      <th className="text-right p-2 border">Assist</th>
                      <th className="text-right p-2 border">Tek.fel</th>
                      <th className="text-right p-2 border">Utanför</th>
                      <th className="text-right p-2 border">Ribba</th>
                      <th className="text-right p-2 border">7m mål</th>
                      <th className="text-right p-2 border">7m miss</th>
                      <th className="text-right p-2 border">Avslut</th>
                      <th className="text-right p-2 border">Skott%</th>
                      <th className="text-right p-2 border">2 min</th>
                      <th className="text-right p-2 border">Gult</th>
                      <th className="text-right p-2 border">Rött</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFieldPlayers.map((row) => (
                        <tr
                          key={row.key}
                          onClick={() => setSeasonPlayerDetail({ ...row, type: "fp" })}
                          className="cursor-pointer hover:bg-slate-50"
                        >
                          <td className="p-2 border">{row.nr}</td>
                          <td className="p-2 border">{row.name}</td>
                          <td className="p-2 border text-right">{row.matches}</td>
                          <td className="p-2 border text-right">{row.goals}</td>
                          <td className="p-2 border text-right">{row.goal}</td>
                          <td className="p-2 border text-right">{row.assist ?? 0}</td>
                          <td className="p-2 border text-right">{row.turnover ?? 0}</td>
                          <td className="p-2 border text-right">{row.wide ?? row.miss ?? 0}</td>
                          <td className="p-2 border text-right">{row.post ?? 0}</td>
                          <td className="p-2 border text-right">{row.sevenGoals}</td>
                          <td className="p-2 border text-right">{row.sevenMiss ?? 0}</td>
                          <td className="p-2 border text-right">{row.attempts}</td>
                          <td className="p-2 border text-right">{row.shotPct}</td>
                          <td className="p-2 border text-right">{row.suspension ?? row.twoMin ?? 0}</td>
                          <td className="p-2 border text-right">{row.yellowCard ?? 0}</td>
                          <td className="p-2 border text-right">{row.redCard ?? 0}</td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {seasonTab === "matches" && (
          <div className="space-y-4">
            <div className="bg-white border rounded-2xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-extrabold text-slate-900">Matcher</div>
                  <div className="text-sm text-slate-500">
                    {filteredMatches.length} av {scopedMatches.length} matcher visas
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowMatchesSearch((v) => !v)}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold border border-black/10"
                    aria-label="Sök matcher"
                    title="Sök matcher"
                  >
                    {showMatchesSearch ? "Dölj sök" : "Visa sök"}
                  </button>
                  {showMatchesSearch && (
                    <input
                      type="text"
                      value={seasonSearchMatches}
                      onChange={(e) => setSeasonSearchMatches(e.target.value)}
                      placeholder="Sök datum, motståndare, hemma/borta, resultat"
                      className="border rounded-xl px-2 py-1 text-sm w-full sm:w-96 h-9"
                      autoFocus
                    />
                  )}
                  {matchDeleteMode ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setMatchDeleteMode(false);
                          setSelectedMatchIdsForDelete([]);
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold border border-black/10"
                      >
                        Avbryt
                      </button>
                      <button
                        type="button"
                        disabled={selectedMatchIdsForDelete.length === 0}
                        onClick={() => {
                          const count = selectedMatchIdsForDelete.length;
                          onConfirm?.({
                            title: "Ta bort matcher?",
                            message: `${count} match${count === 1 ? "" : "er"} tas bort från säsongen.`,
                            confirmText: "Ta bort",
                            cancelText: "Avbryt",
                            variant: "danger",
                            onConfirm: () => {
                              selectedMatchIdsForDelete.forEach((matchId) => onDeleteMatch(matchId));
                              setSelectedMatchIdsForDelete([]);
                              setMatchDeleteMode(false);
                            }
                          });
                        }}
                        className={`px-3 py-2 rounded-xl text-sm font-semibold ${
                          selectedMatchIdsForDelete.length > 0
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "bg-red-200 text-white cursor-not-allowed"
                        }`}
                      >
                        Ta bort valda ({selectedMatchIdsForDelete.length})
                      </button>
                    </>
                  ) : canManageSeason ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMatchDeleteMode(true);
                        setSelectedMatchIdsForDelete([]);
                      }}
                      className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold border border-red-100"
                    >
                      Ta bort
                    </button>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-500">
                      Endast ägare/admin kan ta bort
                    </div>
                  )}
                </div>
              </div>
              {matchDeleteMode && (
                <div className="text-xs text-red-700 mt-2">
                  Välj matcherna som ska tas bort och tryck sedan på Ta bort valda.
                </div>
              )}
              {showMatchesSearch && (
                <div className="text-xs text-slate-500 mt-2">Tips: Du kan söka på datum, motståndare, hemma/borta eller resultat (t.ex. 23-21).</div>
              )}

              {scopedMatches.length === 0 ? (
                <div className="text-sm text-slate-500 mt-3">Inga sparade matcher ännu.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {filteredMatches.map((match) => (
                    (() => {
                      const selectedForDelete = selectedMatchIdsForDelete.includes(match.id);
                      const ourGoals = getOurGoals(match);
                      const oppGoals = getOppGoals(match);
                      const homeGoals = Number(match.result?.home ?? 0);
                      const awayGoals = Number(match.result?.away ?? 0);
                      const diff = ourGoals - oppGoals;
                      const outcome =
                        diff > 0 ? "Vinst" : diff < 0 ? "Förlust" : "Oavgjort";
                      const quickStats = getMatchQuickStats(match);
                      const shotPctValue = quickStats.attempts
                        ? `${Math.round((quickStats.goals / quickStats.attempts) * 100)}%`
                        : "-";
                      return (
                    <div
                      key={match.id}
                      className={`border rounded-2xl p-3 bg-white transition-colors ${
                        selectedForDelete ? "border-red-300 bg-red-50" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {matchDeleteMode && (
                          <input
                            type="checkbox"
                            checked={selectedForDelete}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setSelectedMatchIdsForDelete((prev) =>
                                checked
                                  ? [...prev, match.id]
                                  : prev.filter((matchId) => matchId !== match.id)
                              );
                            }}
                            className="mt-1 h-5 w-5 shrink-0"
                            aria-label="Välj match för borttagning"
                          />
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                            <span>{match.matchInfo?.date || "-"}</span>
                            <span>•</span>
                            <span>{match.matchInfo?.location || "-"}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 ${
                                match.matchType === "cup"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {match.matchType === "cup"
                                ? `${match.cupName || "Cup"}${match.cupPhase ? ` • ${match.cupPhase}` : ""}`
                                : "Serie"}
                            </span>
                          </div>

                          <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                            <div className="min-w-0">
                              <div className="truncate text-lg font-extrabold text-slate-900">
                                {match.matchInfo?.opponent || "Okänd motståndare"}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                                <span>{quickStats.players} spelare</span>
                                <span>•</span>
                                <span>{quickStats.saves} räddningar</span>
                                <span>•</span>
                                <span>{quickStats.assists} assist</span>
                                <span>•</span>
                                <span>{quickStats.turnovers} tekniska fel</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 lg:justify-end">
                              <div className="text-right">
                                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                                  {outcome}
                                </div>
                                <div className="text-3xl font-extrabold text-slate-900">
                                  {homeGoals}–{awayGoals}
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={matchDeleteMode}
                                onClick={() => {
                                  setSeasonMatchPlayerFocus(null);
                                  setSeasonMatchDetail(match);
                                }}
                                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Visa
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Mål</div>
                              <div className="text-lg font-extrabold text-slate-900">{quickStats.goals}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Avslut</div>
                              <div className="text-lg font-extrabold text-slate-900">{quickStats.attempts}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Skott%</div>
                              <div className="text-lg font-extrabold text-slate-900">{shotPctValue}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">2 min</div>
                              <div className="text-lg font-extrabold text-slate-900">{quickStats.suspensions}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                      );
                    })()
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {seasonPlayerDetail && (
        <div className="fixed inset-0 z-[58] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setSeasonPlayerDetail(null)}
            aria-label="Stäng"
          />
          <div className="relative bg-white w-full max-w-3xl rounded-2xl border shadow-2xl p-4 max-h-[85vh] overflow-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-slate-500">Spelardetalj – säsong</div>
                <div className="text-lg font-extrabold">
                  #{seasonPlayerDetail.nr} {seasonPlayerDetail.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSeasonPlayerDetail(null)}
                className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold"
              >
                Stäng
              </button>
            </div>

            {(() => {
              const normKey = (v) => String(v ?? "").toLowerCase().trim();

              const playerId = String(seasonPlayerDetail?.playerId ?? seasonPlayerDetail?.id ?? "").trim();
              const playerNr = String(seasonPlayerDetail?.nr ?? "").trim();
              const playerName = String(seasonPlayerDetail?.name ?? "").trim();
              const isGk = seasonPlayerDetail?.type === "gk";

              const getPlayerFromMatch = (m) => {
                const roster = Array.isArray(m?.playerRoster) ? m.playerRoster : [];
                return (
                  roster.find((p) => playerId && String(p?.playerId ?? p?.id ?? "") === playerId) ||
                  roster.find((p) => playerNr && String(p?.nr ?? p?.shirtNumber ?? "").trim() === playerNr) ||
                  {
                    id: seasonPlayerDetail?.id,
                    playerId: seasonPlayerDetail?.playerId ?? seasonPlayerDetail?.id,
                    nr: seasonPlayerDetail?.nr,
                    shirtNumber: seasonPlayerDetail?.nr,
                    name: seasonPlayerDetail?.name,
                    role: isGk ? "goalkeeper" : "field"
                  }
                );
              };

              const playerMatchRows = (matches || [])
                .map((m) => {
                  const player = getPlayerFromMatch(m);
                  const row = buildMatchStatRow(
                    { ...player, role: isGk ? "goalkeeper" : "field" },
                    m?.stats || {},
                    { history: m?.history || [] }
                  );

                  return {
                    match: m,
                    date: m?.matchInfo?.date || "",
                    opponent: m?.matchInfo?.opponent || "",
                    location: m?.matchInfo?.location || "",
                    score: `${m?.result?.home ?? 0}-${m?.result?.away ?? 0}`,
                    goal: isGk ? row.gkConceded : row.goal,
                    goalOpen: row.goal,
                    totalGoals: row.goals,
                    save: isGk ? row.gkSaves : row.save,
                    saveOpen: row.save,
                    gkSaves: row.gkSaves,
                    gkConceded: row.gkConceded,
                    wide: row.miss,
                    post: row.post,
                    suspension: row.twoMin,
                    sevenGoal: row.sevenGoal,
                    sevenMiss: row.sevenMiss,
                    gkScored: row.gkScored,
                    yellowCard: row.yellowCard,
                    redCard: row.redCard,
                    attempts: row.attempts,
                    shotPct: row.shotPct
                  };
                })
                .filter((r) => {
                  const hasAny =
                    r.goal ||
                    r.save ||
                    r.wide ||
                    r.post ||
                    r.suspension ||
                    r.sevenGoal ||
                    r.sevenMiss ||
                    r.gkScored ||
                    r.yellowCard ||
                    r.redCard;
                  if (hasAny) return true;

                  const roster = Array.isArray(r.match?.playerRoster) ? r.match.playerRoster : [];
                  return roster.some((p) => {
                    const nr = normKey(p?.nr);
                    const name = normKey(p?.name);
                    const id = normKey(p?.playerId ?? p?.id);
                    return (
                      (playerId && id === normKey(playerId)) ||
                      (playerNr && nr === normKey(playerNr)) ||
                      (!playerId && !playerNr && playerName && name === normKey(playerName))
                    );
                  });
                })
                .sort((a, b) => String(a.date).localeCompare(String(b.date), "sv"));

              const totals = playerMatchRows.reduce(
                (acc, r) => {
                  acc.matches += 1;
                  acc.goal += r.goal;
                  acc.goalOpen += r.goalOpen;
                  acc.totalGoals += r.totalGoals;
                  acc.save += r.save;
                  acc.saveOpen += r.saveOpen;
                  acc.wide += r.wide;
                  acc.post += r.post;
                  acc.suspension += r.suspension;
                  acc.sevenGoal += r.sevenGoal;
                  acc.sevenMiss += r.sevenMiss;
                  acc.gkScored += r.gkScored;
                  acc.yellowCard += r.yellowCard;
                  acc.redCard += r.redCard;
                  acc.attempts += r.attempts;
                  return acc;
                },
                {
                  matches: 0,
                  goal: 0,
                  goalOpen: 0,
                  totalGoals: 0,
                  save: 0,
                  saveOpen: 0,
                  wide: 0,
                  post: 0,
                  suspension: 0,
                  sevenGoal: 0,
                  sevenMiss: 0,
                  gkScored: 0,
                  yellowCard: 0,
                  redCard: 0,
                  attempts: 0
                }
              );

              const shotPct = pct(totals.totalGoals, totals.attempts);
              const gkPct = pct(totals.save, totals.save + totals.goal);

              return (
                <div className="mt-4 space-y-4">
                  <div className="bg-slate-50 rounded-xl p-3 text-sm">
                    <div>
                      Matcher: <strong>{totals.matches}</strong>
                    </div>

                    {isGk ? (
                      <>
                        <div>
                          Totalt rädd: <strong>{totals.save}</strong>
                        </div>
                        <div>
                          Rädd spel: <strong>{totals.saveOpen}</strong> • 7m rädd: <strong>{totals.sevenMiss}</strong>
                        </div>
                        <div>
                          Totalt insläppt: <strong>{totals.goal}</strong>
                        </div>
                        <div>
                          Insl. spel: <strong>{totals.goalOpen}</strong> • 7m insl: <strong>{totals.sevenGoal}</strong>
                        </div>
                        <div>
                          Rädd%: <strong>{gkPct}</strong>
                        </div>
                        <div>
                          Utvisningar: <strong>{totals.suspension}</strong>
                        </div>
                        <div>
                          Gult: <strong>{totals.yellowCard}</strong> • Rött: <strong>{totals.redCard}</strong>
                        </div>
                        <div>
                          MV mål: <strong>{totals.gkScored}</strong>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          Totalt mål: <strong>{totals.totalGoals}</strong>
                        </div>
                        <div>
                          Avslut: <strong>{totals.attempts}</strong> • Skott%: <strong>{shotPct}</strong>
                        </div>
                        <div>
                          Rädd: <strong>{totals.save}</strong> • Utanför: <strong>{totals.wide}</strong> • Ribba: <strong>{totals.post}</strong>
                        </div>
                        <div>
                          7m mål: <strong>{totals.sevenGoal}</strong> • 7m miss: <strong>{totals.sevenMiss}</strong>
                        </div>
                        <div>
                          Utvisningar: <strong>{totals.suspension}</strong>
                        </div>
                        <div>
                          Gult: <strong>{totals.yellowCard}</strong> • Rött: <strong>{totals.redCard}</strong>
                        </div>
                      </>
                    )}
                  </div>

                  <div>
                    <div className="text-sm font-semibold mb-2">Per match (klicka för matchdetalj)</div>
                    <div className="overflow-auto relative">
                      <table className="w-full text-sm border">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left p-2 border">Datum</th>
                            <th className="text-left p-2 border">Motståndare</th>
                            <th className="text-left p-2 border">H/B</th>
                            <th className="text-right p-2 border">Resultat</th>
                            {isGk ? (
                              <>
                                <th className="text-right p-2 border">Totalt rädd</th>
                                <th className="text-right p-2 border">Rädd spel</th>
                                <th className="text-right p-2 border">Totalt insl</th>
                                <th className="text-right p-2 border">Insl. spel</th>
                                <th className="text-right p-2 border">Rädd%</th>
                                <th className="text-right p-2 border">Utvisn</th>
                                <th className="text-right p-2 border">Gult</th>
                                <th className="text-right p-2 border">Rött</th>
                                <th className="text-right p-2 border">7m insl</th>
                                <th className="text-right p-2 border">7m rädd</th>
                                <th className="text-right p-2 border">MV mål</th>
                              </>
                            ) : (
                              <>
                                <th className="text-right p-2 border">Totalt mål</th>
                                <th className="text-right p-2 border">Spelmål</th>
                                <th className="text-right p-2 border">Rädd</th>
                                <th className="text-right p-2 border">Utanför</th>
                                <th className="text-right p-2 border">Ribba</th>
                                <th className="text-right p-2 border">7m mål</th>
                                <th className="text-right p-2 border">7m miss</th>
                                <th className="text-right p-2 border">Utvisn</th>
                                <th className="text-right p-2 border">Gult</th>
                                <th className="text-right p-2 border">Rött</th>
                                <th className="text-right p-2 border">Avslut</th>
                                <th className="text-right p-2 border">Skott%</th>
                              </>
                            )}
                            <th className="text-right p-2 border sticky right-0 bg-slate-50">Stat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {playerMatchRows.map((r) => {
                            const m = r.match;
                            const gkP = pct(r.save, r.save + r.goal);
                            return (
                          <tr
                            key={m.id}
                            onClick={() => {
                              // Flow A: open full match (all players)
                              setSeasonPlayerDetail(null);
                              setSeasonMatchPlayerFocus(null);
                              setSeasonMatchDetail(m);
                            }}
                            className="cursor-pointer hover:bg-slate-50"
                          >
                                <td className="p-2 border">{r.date || "-"}</td>
                                <td className="p-2 border">{r.opponent || "-"}</td>
                                <td className="p-2 border">{r.location || "-"}</td>
                                <td className="p-2 border text-right">{r.score}</td>

                                {isGk ? (
                                  <>
                                    <td className="p-2 border text-right">{r.save}</td>
                                    <td className="p-2 border text-right">{r.saveOpen}</td>
                                    <td className="p-2 border text-right">{r.goal}</td>
                                    <td className="p-2 border text-right">{r.goalOpen}</td>
                                    <td className="p-2 border text-right">{gkP}</td>
                                    <td className="p-2 border text-right">{r.suspension}</td>
                                    <td className="p-2 border text-right">{r.yellowCard}</td>
                                    <td className="p-2 border text-right">{r.redCard}</td>
                                    <td className="p-2 border text-right">{r.sevenGoal}</td>
                                    <td className="p-2 border text-right">{r.sevenMiss}</td>
                                    <td className="p-2 border text-right">{r.gkScored}</td>
                                  </>
                                ) : (
                                  <>
                                    <td className="p-2 border text-right">{r.totalGoals}</td>
                                    <td className="p-2 border text-right">{r.goal}</td>
                                    <td className="p-2 border text-right">{r.save}</td>
                                    <td className="p-2 border text-right">{r.wide}</td>
                                    <td className="p-2 border text-right">{r.post}</td>
                                    <td className="p-2 border text-right">{r.sevenGoal}</td>
                                    <td className="p-2 border text-right">{r.sevenMiss}</td>
                                    <td className="p-2 border text-right">{r.suspension}</td>
                                    <td className="p-2 border text-right">{r.yellowCard}</td>
                                    <td className="p-2 border text-right">{r.redCard}</td>
                                    <td className="p-2 border text-right">{r.attempts}</td>
                                    <td className="p-2 border text-right">{r.shotPct}</td>
                                  </>
                                )}
                                <td className="p-2 border text-right min-w-[72px] sticky right-0 bg-white">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Open same match directly in player focus
                                      setSeasonPlayerDetail(null);
                                      setSeasonMatchPlayerFocus({
                                        id: seasonPlayerDetail?.playerId ?? seasonPlayerDetail?.id,
                                        playerId: seasonPlayerDetail?.playerId ?? seasonPlayerDetail?.id,
                                        nr: seasonPlayerDetail?.nr,
                                        name: seasonPlayerDetail?.name,
                                        type: seasonPlayerDetail?.type
                                      });
                                      setSeasonMatchDetail(m);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-semibold w-full"
                                    title="Visa spelarens matchstatistik"
                                    aria-label="Visa spelarens matchstatistik"
                                  >
                                    Stat
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {seasonMatchDetail && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setSeasonMatchDetail(null);
              setSeasonMatchPlayerFocus(null);
            }}
            aria-label="Stäng"
          />
          <div className="relative bg-white w-full max-w-4xl rounded-2xl border shadow-2xl p-4 max-h-[85vh] overflow-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-slate-500">Match</div>
                <div className="text-lg font-extrabold truncate">
                  {seasonMatchDetail?.matchInfo?.date || "-"} • {seasonMatchDetail?.matchInfo?.location || "-"} • {seasonMatchDetail?.matchInfo?.opponent || "Okänd motståndare"}
                </div>
                <div className="text-sm text-slate-700 mt-1">
                  Resultat: {seasonMatchDetail?.result?.home ?? 0} – {seasonMatchDetail?.result?.away ?? 0}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {seasonMatchDetail?.matchType === "cup"
                    ? `🏆 ${seasonMatchDetail?.cupName || "Cup"}${seasonMatchDetail?.cupPhase ? ` • ${seasonMatchDetail.cupPhase}` : ""}`
                    : "Serie"}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                {onExportMatchExcel && (
                  <button
                    type="button"
                    onClick={() => onExportMatchExcel(seasonMatchDetail)}
                    className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-sm font-semibold text-white"
                  >
                    Excel
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSeasonMatchDetail(null);
                    setSeasonMatchPlayerFocus(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold"
                >
                  Stäng
                </button>
              </div>
            </div>

            {(() => {
              const roster = Array.isArray(seasonMatchDetail?.playerRoster)
                ? seasonMatchDetail.playerRoster
                : [];
              const statsMap = seasonMatchDetail?.stats || {};

              const normKey = (v) => String(v ?? "").toLowerCase().trim();

              // Build a set of known goalkeepers.
              // 1) Prefer team lineup (selectedTeam) since it is the authoritative roster used in MatchView/export.
              // 2) Fallback to seasonSummary.goalkeepers.
              const knownGkKeys = new Set();

              const addGk = (nr, name) => {
                const key = `${normKey(nr)}|${normKey(name)}`;
                if (key !== "|" && key !== "") knownGkKeys.add(key);
              };

              // From team data: common shapes
              const teamGks =
                selectedTeam?.goalkeepers ||
                selectedTeam?.keepers ||
                selectedTeam?.gks ||
                [];

              if (Array.isArray(teamGks)) {
                teamGks.forEach((g) => addGk(g?.nr, g?.name));
              }

              // Also support a single unified players list where GK is marked by position/isGoalkeeper
              const teamPlayers =
                selectedTeam?.players ||
                selectedTeam?.roster ||
                selectedTeam?.playerRoster ||
                [];

              if (Array.isArray(teamPlayers)) {
                teamPlayers.forEach((p) => {
                  const pos = String(p?.position || "").toUpperCase();
                  const isGK = pos === "GK" || pos === "G" || p?.isGoalkeeper === true;
                  if (isGK) addGk(p?.nr, p?.name);
                });
              }

              // Fallback: whatever season has learned as goalkeepers
              (seasonSummary?.goalkeepers || []).forEach((g) => addGk(g?.nr, g?.name));

              const isGkByRoster = (p) => {
                const pos = String(p?.position || "").toUpperCase();
                return p?.role === "goalkeeper" || pos === "GK" || pos === "G" || p?.isGoalkeeper === true;
              };

              const isKnownGk = (p) => {
                const key = `${normKey(p?.nr)}|${normKey(p?.name)}`;
                return knownGkKeys.has(key);
              };

              const isGoalkeeperForMatch = (p) => isGkByRoster(p) || isKnownGk(p);

              const rows = roster.map((p) => {
                const isGoalkeeper = isGoalkeeperForMatch(p);
                const row = buildMatchStatRow(
                  { ...p, role: isGoalkeeper ? "goalkeeper" : "field" },
                  statsMap,
                  { history: seasonMatchDetail?.history || [] }
                );

                return {
                  id: p?.id,
                  playerId: p?.playerId ?? p?.id,
                  nr: p?.nr ?? "",
                  name: p?.name ?? "",
                  position: p?.position,
                  goals: isGoalkeeper ? row.gkConceded : row.goal,
                  goalOpen: row.goal,
                  totalGoals: row.goals,
                  saves: isGoalkeeper ? row.gkSaves : row.save,
                  saveOpen: row.save,
                  wide: row.miss,
                  post: row.post,
                  suspension: row.twoMin,
                  sevenGoal: row.sevenGoal,
                  sevenMiss: row.sevenMiss,
                  gkScored: row.gkScored,
                  yellowCard: row.yellowCard,
                  redCard: row.redCard,
                  attempts: row.attempts,
                  isGoalkeeper,
                  gkConceded: row.gkConceded,
                  savePct: row.savePct,
                  shotPct: row.shotPct
                };
              });

              // --- PLAYER FOCUS LOGIC ---
              const focus = seasonMatchPlayerFocus;
              const focusKey = focus ? `${normKey(focus.nr)}|${normKey(focus.name)}` : null;
              const focusPlayerId = focus?.playerId ?? focus?.id;
              const focusId = focusPlayerId != null ? String(focusPlayerId) : "";

              const matchFocusRow = focus
                ? rows.find((r) => (focusId && String(r.playerId ?? r.id ?? "") === focusId) || `${normKey(r.nr)}|${normKey(r.name)}` === focusKey)
                : null;

              if (focus && matchFocusRow) {
                const r = matchFocusRow;
                const isGK = r.isGoalkeeper;
                const gkPct = pct(r.saves, r.saves + r.goals);
                const fpPct = r.shotPct;

                return (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">Spelare – match</div>
                      <button
                        type="button"
                        onClick={() => setSeasonMatchPlayerFocus(null)}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold"
                      >
                        Visa alla
                      </button>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-3 text-sm">
                      <div className="font-semibold">#{r.nr} {r.name}{isGK ? " (Målvakt)" : ""}</div>

                      {isGK ? (
                        <div className="mt-3 overflow-auto">
                          <table className="w-full text-sm border bg-white">
                            <tbody>
                              <tr>
                                <td className="p-2 border">Totalt rädd</td>
                                <td className="p-2 border text-right"><strong>{r.saves}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Rädd spel</td>
                                <td className="p-2 border text-right"><strong>{r.saveOpen}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">7m rädd</td>
                                <td className="p-2 border text-right"><strong>{r.sevenMiss}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Totalt insläppt</td>
                                <td className="p-2 border text-right"><strong>{r.goals}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Insl. spel</td>
                                <td className="p-2 border text-right"><strong>{r.goalOpen}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">7m insl</td>
                                <td className="p-2 border text-right"><strong>{r.sevenGoal}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Rädd%</td>
                                <td className="p-2 border text-right"><strong>{gkPct}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Utvisningar</td>
                                <td className="p-2 border text-right"><strong>{r.suspension}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Gult</td>
                                <td className="p-2 border text-right"><strong>{r.yellowCard}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Rött</td>
                                <td className="p-2 border text-right"><strong>{r.redCard}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">MV mål</td>
                                <td className="p-2 border text-right"><strong>{r.gkScored}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Utanför</td>
                                <td className="p-2 border text-right"><strong>{r.wide}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Ribba</td>
                                <td className="p-2 border text-right"><strong>{r.post}</strong></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="mt-3 overflow-auto">
                          <table className="w-full text-sm border bg-white">
                            <tbody>
                              <tr>
                                <td className="p-2 border">Spelmål</td>
                                <td className="p-2 border text-right"><strong>{r.goals}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">7m mål</td>
                                <td className="p-2 border text-right"><strong>{r.sevenGoal}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">7m miss</td>
                                <td className="p-2 border text-right"><strong>{r.sevenMiss}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Totala mål</td>
                                <td className="p-2 border text-right"><strong>{r.totalGoals}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Avslut</td>
                                <td className="p-2 border text-right"><strong>{r.attempts}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Skott%</td>
                                <td className="p-2 border text-right"><strong>{fpPct}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Rädd (skott räddat)</td>
                                <td className="p-2 border text-right"><strong>{r.saves}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Utanför</td>
                                <td className="p-2 border text-right"><strong>{r.wide}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Ribba</td>
                                <td className="p-2 border text-right"><strong>{r.post}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Utvisningar</td>
                                <td className="p-2 border text-right"><strong>{r.suspension}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Gult</td>
                                <td className="p-2 border text-right"><strong>{r.yellowCard}</strong></td>
                              </tr>
                              <tr>
                                <td className="p-2 border">Rött</td>
                                <td className="p-2 border text-right"><strong>{r.redCard}</strong></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              // --- END PLAYER FOCUS LOGIC ---

              const gks = rows
                .filter((r) => r.isGoalkeeper)
                .map((r) => ({
                  ...r,
                  gkSaves: r.saves,
                  gkConceded: r.goals,
                  gkPct: r.savePct
                }))
                .sort((a, b) =>
                  Number(a.nr) - Number(b.nr) ||
                  String(a.nr).localeCompare(String(b.nr), "sv") ||
                  String(a.name).localeCompare(String(b.name), "sv")
                );

              const fps = rows
                .filter((r) => !r.isGoalkeeper)
                .map((r) => ({ ...r, sevenAtt: r.sevenGoal + r.sevenMiss }))
                .sort((a, b) =>
                  Number(a.nr) - Number(b.nr) ||
                  String(a.nr).localeCompare(String(b.nr), "sv") ||
                  String(a.name).localeCompare(String(b.name), "sv")
                );

              return (
                <div className="mt-4 space-y-5">
                  {gks.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold mb-2">Målvakter – match (alla stats)</div>
                      <div className="overflow-auto">
                        <table className="w-full text-sm border">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="text-left p-2 border">#</th>
                              <th className="text-left p-2 border">Målvakt</th>
                              <th className="text-right p-2 border">Totalt rädd</th>
                              <th className="text-right p-2 border">Rädd</th>
                              <th className="text-right p-2 border">Totalt insl</th>
                              <th className="text-right p-2 border">Insl. spel</th>
                              <th className="text-right p-2 border">Utanför</th>
                              <th className="text-right p-2 border">Ribba</th>
                              <th className="text-right p-2 border">Rädd%</th>
                              <th className="text-right p-2 border">7m insl</th>
                              <th className="text-right p-2 border">7m rädd</th>
                              <th className="text-right p-2 border">Utvisn</th>
                              <th className="text-right p-2 border">Gult</th>
                              <th className="text-right p-2 border">Rött</th>
                            </tr>
                          </thead>
                          <tbody>
                            {gks.map((r) => (
                              <tr
                                key={r.playerId || r.id || r.name}
                                onClick={() => setSeasonMatchPlayerFocus({ id: r.playerId ?? r.id, playerId: r.playerId ?? r.id, nr: r.nr, name: r.name, type: "gk" })}
                                className="cursor-pointer hover:bg-slate-50"
                              >
                                <td className="p-2 border">{r.nr}</td>
                                <td className="p-2 border">{r.name}</td>
                                <td className="p-2 border text-right">{r.gkSaves}</td>
                                <td className="p-2 border text-right">{r.saveOpen}</td>
                                <td className="p-2 border text-right">{r.gkConceded}</td>
                                <td className="p-2 border text-right">{r.goalOpen}</td>
                                <td className="p-2 border text-right">{r.wide}</td>
                                <td className="p-2 border text-right">{r.post}</td>
                                <td className="p-2 border text-right">{r.gkPct}</td>
                                <td className="p-2 border text-right">{r.sevenGoal}</td>
                                <td className="p-2 border text-right">{r.sevenMiss}</td>
                                <td className="p-2 border text-right">{r.suspension}</td>
                                <td className="p-2 border text-right">{r.yellowCard}</td>
                                <td className="p-2 border text-right">{r.redCard}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-sm font-semibold mb-2">Utespelare – match (alla stats)</div>
                    <div className="overflow-auto">
                      <table className="w-full text-sm border">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left p-2 border">#</th>
                            <th className="text-left p-2 border">Spelare</th>
                            <th className="text-right p-2 border">Totalt mål</th>
                            <th className="text-right p-2 border">Spelmål</th>
                            <th className="text-right p-2 border">Rädd</th>
                            <th className="text-right p-2 border">Utanför</th>
                            <th className="text-right p-2 border">Ribba</th>
                            <th className="text-right p-2 border">Skott%</th>
                            <th className="text-right p-2 border">7m mål</th>
                            <th className="text-right p-2 border">7m miss</th>
                            <th className="text-right p-2 border">Utvisn</th>
                            <th className="text-right p-2 border">Gult</th>
                            <th className="text-right p-2 border">Rött</th>
                            <th className="text-right p-2 border">Avslut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fps.map((r) => (
                            <tr
                              key={r.playerId || r.id || r.name}
                              onClick={() => setSeasonMatchPlayerFocus({ id: r.playerId ?? r.id, playerId: r.playerId ?? r.id, nr: r.nr, name: r.name, type: "fp" })}
                              className="cursor-pointer hover:bg-slate-50"
                            >
                              <td className="p-2 border">{r.nr}</td>
                              <td className="p-2 border">{r.name}</td>
                              <td className="p-2 border text-right">{r.totalGoals}</td>
                              <td className="p-2 border text-right">{r.goals}</td>
                              <td className="p-2 border text-right">{r.saves}</td>
                              <td className="p-2 border text-right">{r.wide}</td>
                              <td className="p-2 border text-right">{r.post}</td>
                              <td className="p-2 border text-right">{r.shotPct}</td>
                              <td className="p-2 border text-right">{r.sevenGoal}</td>
                              <td className="p-2 border text-right">{r.sevenMiss}</td>
                              <td className="p-2 border text-right">{r.suspension}</td>
                              <td className="p-2 border text-right">{r.yellowCard}</td>
                              <td className="p-2 border text-right">{r.redCard}</td>
                              <td className="p-2 border text-right">{r.attempts}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {seasonDangerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setSeasonDangerOpen(false)}
            aria-label="Stäng"
          />
          <div className="relative bg-white w-full max-w-lg rounded-2xl border shadow-2xl p-4">
            <div className="text-lg font-extrabold text-red-700">Rensa säsong</div>
            <div className="mt-2 text-sm text-slate-700">
              Detta tar bort alla sparade matcher för denna säsong (för valt lag). Det går inte att ångra.
            </div>

            <div className="mt-3 text-sm font-semibold">
              Skriv <span className="font-mono">RADERA</span> för att bekräfta
            </div>
            <input
              type="text"
              value={seasonDangerText}
              onChange={(e) => setSeasonDangerText(e.target.value)}
              placeholder="RADERA"
              className="mt-2 w-full border rounded-xl px-3 py-2"
            />

            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setSeasonDangerOpen(false)}
                className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 font-semibold"
              >
                Avbryt
              </button>
              <button
                type="button"
                disabled={seasonDangerText.trim().toUpperCase() !== "RADERA"}
                onClick={() => {
                  onClearSeason();
                  setSeasonDangerOpen(false);
                }}
                className={`px-3 py-2 rounded-xl font-semibold text-white ${
                  seasonDangerText.trim().toUpperCase() === "RADERA"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-red-300 cursor-not-allowed"
                }`}
              >
                Rensa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
