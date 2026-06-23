import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  buildMatchStatRow,
  buildSeasonKpis as makeSeasonKpis,
  buildSeasonSummary as makeSeasonSummary,
  pct
} from "../lib/appHelpers";

const comparePlayerNames = (a, b) =>
  String(a?.name || "").localeCompare(String(b?.name || ""), "sv", { sensitivity: "base" }) ||
  String(a?.nr ?? "").localeCompare(String(b?.nr ?? ""), "sv");

const percentageValue = (value) => Number.parseFloat(String(value || "0").replace("%", "")) || 0;

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
  const [showMatchesSearch, setShowMatchesSearch] = useState(false);
  const [seasonPlayerGroup, setSeasonPlayerGroup] = useState("all");
  const [seasonPlayerSort, setSeasonPlayerSort] = useState("name");
  const [seasonDangerOpen, setSeasonDangerOpen] = useState(false);
  const [seasonDangerText, setSeasonDangerText] = useState("");
  const [seasonMatchDetail, setSeasonMatchDetail] = useState(null);
  const [seasonPlayerDetail, setSeasonPlayerDetail] = useState(null);
  const [seasonMatchPlayerFocus, setSeasonMatchPlayerFocus] = useState(null);
  const [seasonScope, setSeasonScope] = useState("all");
  const [matchDeleteMode, setMatchDeleteMode] = useState(false);
  const [selectedMatchIdsForDelete, setSelectedMatchIdsForDelete] = useState([]);
  const [seasonToolsOpen, setSeasonToolsOpen] = useState(false);
  const importInputRef = useRef(null);
  const seasonToolsRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setSeasonTab("overview");
      setSeasonSearchPlayers("");
      setSeasonSearchMatches("");
      setSeasonDangerOpen(false);
      setSeasonDangerText("");
      setSeasonMatchDetail(null);
      setShowMatchesSearch(false);
      setSeasonPlayerGroup("all");
      setSeasonPlayerSort("name");
      setSeasonMatchPlayerFocus(null);
      setSeasonScope("all");
      setMatchDeleteMode(false);
      setSelectedMatchIdsForDelete([]);
      setSeasonToolsOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!seasonToolsOpen) return undefined;

    const closeTools = (event) => {
      if (event.key === "Escape" || !seasonToolsRef.current?.contains(event.target)) {
        setSeasonToolsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeTools);
    document.addEventListener("keydown", closeTools);
    return () => {
      document.removeEventListener("pointerdown", closeTools);
      document.removeEventListener("keydown", closeTools);
    };
  }, [seasonToolsOpen]);

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
    const avgConceded = matchRows.length > 0 ? Math.round((matchRows.reduce((sum, row) => sum + row.oppGoals, 0) / matchRows.length) * 10) / 10 : 0;
    const wins = matchRows.filter((row) => row.diff > 0).length;
    const draws = matchRows.filter((row) => row.diff === 0).length;
    const losses = matchRows.filter((row) => row.diff < 0).length;
    const goalDiff = matchRows.reduce((sum, row) => sum + row.diff, 0);
    const recentMatches = [...matchRows]
      .sort((a, b) => String(b.match?.matchInfo?.date || "").localeCompare(String(a.match?.matchInfo?.date || ""), "sv"))
      .slice(0, 3);

    return {
      bestMatch,
      strongestDefense,
      mostGoals,
      avgGoals,
      avgConceded,
      wins,
      draws,
      losses,
      goalDiff,
      recentMatches
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
        if (seasonPlayerSort === "matches") return (b.matches || 0) - (a.matches || 0) || comparePlayerNames(a, b);
        if (seasonPlayerSort === "goals") return (b.goals || 0) - (a.goals || 0) || comparePlayerNames(a, b);
        if (seasonPlayerSort === "assists") return (b.assist || 0) - (a.assist || 0) || comparePlayerNames(a, b);
        if (seasonPlayerSort === "shotPct") return percentageValue(b.shotPct) - percentageValue(a.shotPct) || comparePlayerNames(a, b);
        return comparePlayerNames(a, b);
      });
  }, [seasonPlayerSort, seasonSearchPlayers, scopedSeasonSummary.fieldPlayers]);

  const filteredGoalkeepers = useMemo(() => {
    const query = norm(seasonSearchPlayers);
    return scopedSeasonSummary.goalkeepers
      .filter((row) => {
        if (!query) return true;
        return String(row.nr).includes(query) || norm(row.name).includes(query);
      })
      .sort((a, b) => {
        if (seasonPlayerSort === "matches") return (b.matches || 0) - (a.matches || 0) || comparePlayerNames(a, b);
        if (seasonPlayerSort === "saves") return (b.gkSaves || 0) - (a.gkSaves || 0) || comparePlayerNames(a, b);
        if (seasonPlayerSort === "savePct") return percentageValue(b.savePct) - percentageValue(a.savePct) || comparePlayerNames(a, b);
        return comparePlayerNames(a, b);
      });
  }, [seasonPlayerSort, seasonSearchPlayers, scopedSeasonSummary.goalkeepers]);

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

  const renderFieldPlayerList = () => (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-[minmax(0,1fr)_3.25rem_3.5rem_3.5rem_4rem] items-center gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500 sm:grid-cols-[minmax(0,1fr)_4rem_4rem_4rem_4.5rem]">
        <div>Spelare</div>
        <div className="text-right">Matcher</div>
        <div className="text-right">Mål</div>
        <div className="text-right">Assist</div>
        <div className="text-right">Skott %</div>
      </div>
      <div className="divide-y divide-slate-100">
        {filteredFieldPlayers.map((row) => (
          <button
            key={row.key}
            type="button"
            onClick={() => setSeasonPlayerDetail({ ...row, type: "fp" })}
            className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_3.25rem_3.5rem_3.5rem_4rem] items-center gap-1 px-3 py-2 text-left hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_4rem_4rem_4rem_4.5rem]"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-900">{row.name}</div>
              <div className="text-xs text-slate-500">#{row.nr}</div>
            </div>
            <div className="text-right text-sm font-semibold tabular-nums text-slate-700">{row.matches}</div>
            <div className="text-right text-sm font-extrabold tabular-nums text-slate-900">{row.goals}</div>
            <div className="text-right text-sm font-semibold tabular-nums text-slate-700">{row.assist ?? 0}</div>
            <div className="text-right text-sm font-semibold tabular-nums text-slate-700">{row.shotPct || "–"}</div>
          </button>
        ))}
        {filteredFieldPlayers.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-500">Inga utespelare matchar sökningen.</div>
        )}
      </div>
    </div>
  );

  const renderGoalkeeperList = () => (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-[minmax(0,1fr)_3.25rem_3.5rem_3.5rem_4rem] items-center gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500 sm:grid-cols-[minmax(0,1fr)_4rem_4rem_4rem_4.5rem]">
        <div>Målvakt</div>
        <div className="text-right">Matcher</div>
        <div className="text-right">Rädd</div>
        <div className="text-right">Insläppta</div>
        <div className="text-right">Rädd %</div>
      </div>
      <div className="divide-y divide-slate-100">
        {filteredGoalkeepers.map((row) => (
          <button
            key={row.key}
            type="button"
            onClick={() => setSeasonPlayerDetail({ ...row, type: "gk" })}
            className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_3.25rem_3.5rem_3.5rem_4rem] items-center gap-1 px-3 py-2 text-left hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_4rem_4rem_4rem_4.5rem]"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-900">{row.name}</div>
              <div className="text-xs text-slate-500">#{row.nr}</div>
            </div>
            <div className="text-right text-sm font-semibold tabular-nums text-slate-700">{row.matches}</div>
            <div className="text-right text-sm font-extrabold tabular-nums text-slate-900">{row.gkSaves}</div>
            <div className="text-right text-sm font-semibold tabular-nums text-slate-700">{row.gkConceded}</div>
            <div className="text-right text-sm font-semibold tabular-nums text-slate-700">{row.savePct || "–"}</div>
          </button>
        ))}
        {filteredGoalkeepers.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-500">Inga målvakter matchar sökningen.</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="season-center-shell fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-50">
      <div className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-500">Säsongscenter</div>
              <h1 className="truncate text-xl font-extrabold text-slate-900">
                {selectedTeam?.name || "Valt lag"}
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {onImportBackup && (
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleImportFile}
                />
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold"
              >
                Tillbaka
              </button>

              <div ref={seasonToolsRef} className="relative">
                <button
                  type="button"
                  onClick={() => setSeasonToolsOpen((value) => !value)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-xl font-bold leading-none text-slate-600 hover:bg-slate-100"
                  aria-label="Import och backup"
                  aria-haspopup="menu"
                  aria-expanded={seasonToolsOpen}
                  title="Import och backup"
                >
                  ⋯
                </button>

                {seasonToolsOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-11 z-20 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
                  >
                    {onImportBackup && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setSeasonToolsOpen(false);
                          importInputRef.current?.click();
                        }}
                        className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Importera JSON
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setSeasonToolsOpen(false);
                        onExportBackup();
                      }}
                      className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Ladda ner backup
                    </button>
                    {canManageSeason && (
                      <div className="mt-1 border-t border-slate-200 pt-1">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setSeasonToolsOpen(false);
                            setSeasonDangerOpen(true);
                            setSeasonDangerText("");
                          }}
                          className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          Rensa säsong
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {onSeasonChange && (
                <select
                  value={selectedSeason || ""}
                  onChange={(e) => onSeasonChange(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
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
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
              >
                {scopeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <dl className="grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50">
              <div className="min-w-[5rem] px-3 py-1.5 text-center">
                <dt className="text-[11px] font-medium text-slate-500">Matcher</dt>
                <dd className="text-base font-extrabold leading-tight tabular-nums text-slate-900">
                  {scopedSeasonKpis.matchCount}
                </dd>
              </div>
              <div className="min-w-[5rem] px-3 py-1.5 text-center">
                <dt className="text-[11px] font-medium text-slate-500">Mål</dt>
                <dd className="text-base font-extrabold leading-tight tabular-nums text-slate-900">
                  {scopedSeasonKpis.ourGoals}
                </dd>
              </div>
              <div className="min-w-[5rem] px-3 py-1.5 text-center">
                <dt className="text-[11px] font-medium text-slate-500">Insläppta</dt>
                <dd className="text-base font-extrabold leading-tight tabular-nums text-slate-900">
                  {scopedSeasonKpis.oppGoals}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 pt-1">
          <div
            className="grid h-11 w-full grid-cols-3 sm:w-96"
            role="tablist"
            aria-label="Säsongsvyer"
          >
            <button
              type="button"
              onClick={() => setSeasonTab("overview")}
              role="tab"
              aria-selected={seasonTab === "overview"}
              className={`relative h-11 px-4 text-sm font-semibold transition-colors after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full ${
                seasonTab === "overview"
                  ? "text-slate-950 after:bg-sky-600"
                  : "text-slate-500 after:bg-transparent hover:text-slate-800"
              }`}
            >
              Översikt
            </button>
            <button
              type="button"
              onClick={() => setSeasonTab("players")}
              role="tab"
              aria-selected={seasonTab === "players"}
              className={`relative h-11 px-4 text-sm font-semibold transition-colors after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full ${
                seasonTab === "players"
                  ? "text-slate-950 after:bg-sky-600"
                  : "text-slate-500 after:bg-transparent hover:text-slate-800"
              }`}
            >
              Spelare
            </button>
            <button
              type="button"
              onClick={() => setSeasonTab("matches")}
              role="tab"
              aria-selected={seasonTab === "matches"}
              className={`relative h-11 px-4 text-sm font-semibold transition-colors after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full ${
                seasonTab === "matches"
                  ? "text-slate-950 after:bg-sky-600"
                  : "text-slate-500 after:bg-transparent hover:text-slate-800"
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
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-900">Säsongsresultat</h2>
                <p className="text-xs text-slate-500">Resultat för valt matchfilter</p>
              </div>
              <dl className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4 sm:divide-y-0">
                <div className="px-4 py-3">
                  <dt className="text-xs font-medium text-slate-500">Vinster</dt>
                  <dd className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-700">{overviewHighlights.wins}</dd>
                </div>
                <div className="px-4 py-3">
                  <dt className="text-xs font-medium text-slate-500">Oavgjorda</dt>
                  <dd className="mt-1 text-2xl font-extrabold tabular-nums text-slate-800">{overviewHighlights.draws}</dd>
                </div>
                <div className="px-4 py-3">
                  <dt className="text-xs font-medium text-slate-500">Förluster</dt>
                  <dd className="mt-1 text-2xl font-extrabold tabular-nums text-rose-700">{overviewHighlights.losses}</dd>
                </div>
                <div className="px-4 py-3">
                  <dt className="text-xs font-medium text-slate-500">Målskillnad</dt>
                  <dd className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">
                    {overviewHighlights.goalDiff > 0 ? "+" : ""}{overviewHighlights.goalDiff}
                  </dd>
                </div>
              </dl>
            </section>

            <div className="grid gap-4 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-bold text-slate-900">Mål per match</h2>
                <div className="mt-4 grid grid-cols-2 divide-x divide-slate-200">
                  <div className="pr-4">
                    <div className="text-xs font-medium text-slate-500">Gjorda</div>
                    <div className="mt-1 text-3xl font-extrabold tabular-nums text-slate-900">{overviewHighlights.avgGoals}</div>
                  </div>
                  <div className="pl-4">
                    <div className="text-xs font-medium text-slate-500">Insläppta</div>
                    <div className="mt-1 text-3xl font-extrabold tabular-nums text-slate-900">{overviewHighlights.avgConceded}</div>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-bold text-slate-900">Senaste matcher</h2>
                {overviewHighlights.recentMatches.length > 0 ? (
                  <div className="mt-2 divide-y divide-slate-100">
                    {overviewHighlights.recentMatches.map((row) => (
                      <div key={row.match.id || `${row.meta}-${row.label}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-800">{row.label}</div>
                          <div className="text-xs text-slate-500">{row.meta}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${
                            row.diff > 0 ? "text-emerald-700" : row.diff < 0 ? "text-rose-700" : "text-slate-500"
                          }`}>
                            {row.diff > 0 ? "Vinst" : row.diff < 0 ? "Förlust" : "Oavgjort"}
                          </span>
                          <span className="min-w-[3.5rem] text-right text-lg font-extrabold tabular-nums text-slate-900">{row.score}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">
                    Inga matcher finns i det valda urvalet ännu.
                  </div>
                )}
              </section>
            </div>

            {overviewHighlights.bestMatch && (
              <section>
                <h2 className="mb-2 text-sm font-bold text-slate-700">Säsongens höjdpunkter</h2>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold text-slate-500">Bästa resultat</div>
                    <div className="mt-2 truncate font-semibold text-slate-800">{overviewHighlights.bestMatch.label}</div>
                    <div className="text-xs text-slate-500">{overviewHighlights.bestMatch.meta}</div>
                    <div className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900">{overviewHighlights.bestMatch.score}</div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold text-slate-500">Starkaste försvar</div>
                    <div className="mt-2 truncate font-semibold text-slate-800">{overviewHighlights.strongestDefense.label}</div>
                    <div className="text-xs text-slate-500">{overviewHighlights.strongestDefense.meta}</div>
                    <div className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900">{overviewHighlights.strongestDefense.score}</div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold text-slate-500">Flest gjorda mål</div>
                    <div className="mt-2 truncate font-semibold text-slate-800">{overviewHighlights.mostGoals.label}</div>
                    <div className="text-xs text-slate-500">{overviewHighlights.mostGoals.meta}</div>
                    <div className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900">{overviewHighlights.mostGoals.ourGoals}</div>
                  </div>
                </div>
              </section>
            )}

            {!canManageSeason && (
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
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Spelare</h2>
                <p className="text-sm text-slate-500">
                  {scopedSeasonSummary.fieldPlayers.length + scopedSeasonSummary.goalkeepers.length} spelare i urvalet
                </p>
              </div>

              <div className="grid h-10 w-full grid-cols-3 rounded-lg bg-slate-200 p-1 sm:w-[30rem]" role="tablist" aria-label="Spelartyper">
                <button
                  type="button"
                  role="tab"
                  aria-selected={seasonPlayerGroup === "goalkeepers"}
                  onClick={() => {
                    setSeasonPlayerGroup("goalkeepers");
                    setSeasonPlayerSort("name");
                  }}
                  className={`rounded-md px-3 text-sm font-semibold ${
                    seasonPlayerGroup === "goalkeepers" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                  }`}
                >
                  Målvakter ({scopedSeasonSummary.goalkeepers.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={seasonPlayerGroup === "field"}
                  onClick={() => {
                    setSeasonPlayerGroup("field");
                    setSeasonPlayerSort("name");
                  }}
                  className={`rounded-md px-3 text-sm font-semibold ${
                    seasonPlayerGroup === "field" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                  }`}
                >
                  Utespelare ({scopedSeasonSummary.fieldPlayers.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={seasonPlayerGroup === "all"}
                  onClick={() => {
                    setSeasonPlayerGroup("all");
                    setSeasonPlayerSort("name");
                  }}
                  className={`rounded-md px-2 text-sm font-semibold ${
                    seasonPlayerGroup === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                  }`}
                >
                  Alla ({scopedSeasonSummary.fieldPlayers.length + scopedSeasonSummary.goalkeepers.length})
                </button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_13rem]">
              <input
                type="search"
                value={seasonSearchPlayers}
                onChange={(e) => setSeasonSearchPlayers(e.target.value)}
                placeholder="Sök namn eller nummer"
                aria-label="Sök spelare"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
              <select
                value={seasonPlayerSort}
                onChange={(e) => setSeasonPlayerSort(e.target.value)}
                aria-label="Sortera spelare"
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"
              >
                <option value="name">Namn A–Ö</option>
                <option value="matches">Flest matcher</option>
                {seasonPlayerGroup === "field" && (
                  <>
                    <option value="goals">Flest mål</option>
                    <option value="assists">Flest assist</option>
                    <option value="shotPct">Högst skottprocent</option>
                  </>
                )}
                {seasonPlayerGroup === "goalkeepers" && (
                  <>
                    <option value="saves">Flest räddningar</option>
                    <option value="savePct">Högst räddningsprocent</option>
                  </>
                )}
              </select>
            </div>

            {seasonPlayerGroup === "all" ? (
              <div className="space-y-4">
                <section>
                  <h3 className="mb-2 text-sm font-bold text-slate-700">Målvakter ({filteredGoalkeepers.length})</h3>
                  {renderGoalkeeperList()}
                </section>
                <section>
                  <h3 className="mb-2 text-sm font-bold text-slate-700">Utespelare ({filteredFieldPlayers.length})</h3>
                  {renderFieldPlayerList()}
                </section>
              </div>
            ) : seasonPlayerGroup === "goalkeepers" ? (
              renderGoalkeeperList()
            ) : (
              renderFieldPlayerList()
            )}
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
