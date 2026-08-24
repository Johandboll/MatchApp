import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDocumentScrollLock } from "../hooks/useDocumentScrollLock";
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

function SeasonDropdown({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selectedOption = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;

    const closeDropdown = (event) => {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (event.type === "click" && dropdownRef.current?.contains(event.target)) return;
      setOpen(false);
    };

    document.addEventListener("click", closeDropdown);
    document.addEventListener("keydown", closeDropdown);
    return () => {
      document.removeEventListener("click", closeDropdown);
      document.removeEventListener("keydown", closeDropdown);
    };
  }, [open]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-10 min-w-36 items-center justify-between gap-3 rounded-lg border bg-white px-3 text-sm font-semibold text-slate-800 ${
          open ? "border-sky-500 ring-2 ring-sky-100" : "border-slate-300 hover:border-slate-400"
        }`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="max-w-56 truncate">{selectedOption?.label || value}</span>
        <span className={`text-xs text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">▾</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute left-0 top-11 z-30 max-h-72 min-w-full w-max max-w-xs overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-4 rounded-md px-3 py-2 text-left text-sm font-semibold ${
                  selected ? "bg-sky-50 text-sky-800" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="whitespace-nowrap">{option.label}</span>
                <span className={`text-sky-700 ${selected ? "visible" : "invisible"}`} aria-hidden="true">✓</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SeasonCenter({
  open,
  selectedTeam,
  teams = [],
  selectedTeamId,
  onSelectTeam,
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
  useDocumentScrollLock(open);
  const [seasonTab, setSeasonTab] = useState("overview");
  const [seasonSearchPlayers, setSeasonSearchPlayers] = useState("");
  const [seasonSearchMatches, setSeasonSearchMatches] = useState("");
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
  const [matchToolsOpen, setMatchToolsOpen] = useState(false);
  const importInputRef = useRef(null);
  const seasonToolsRef = useRef(null);
  const matchToolsRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setSeasonTab("overview");
      setSeasonSearchPlayers("");
      setSeasonSearchMatches("");
      setSeasonDangerOpen(false);
      setSeasonDangerText("");
      setSeasonMatchDetail(null);
      setSeasonPlayerGroup("all");
      setSeasonPlayerSort("name");
      setSeasonMatchPlayerFocus(null);
      setSeasonScope("all");
      setMatchDeleteMode(false);
      setSelectedMatchIdsForDelete([]);
      setSeasonToolsOpen(false);
      setMatchToolsOpen(false);
    }
  }, [open]);

  const handleTeamChange = (teamId) => {
    setSeasonMatchDetail(null);
    setSeasonPlayerDetail(null);
    setSeasonMatchPlayerFocus(null);
    setMatchDeleteMode(false);
    setSelectedMatchIdsForDelete([]);
    onSelectTeam?.(teamId);
  };

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

  useEffect(() => {
    if (!matchToolsOpen) return undefined;

    const closeMatchTools = (event) => {
      if (event.key === "Escape" || !matchToolsRef.current?.contains(event.target)) {
        setMatchToolsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeMatchTools);
    document.addEventListener("keydown", closeMatchTools);
    return () => {
      document.removeEventListener("pointerdown", closeMatchTools);
      document.removeEventListener("keydown", closeMatchTools);
    };
  }, [matchToolsOpen]);

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
                <SeasonDropdown
                  label="Välj säsong"
                  value={selectedSeason || ""}
                  options={seasonOptions.map((season) => ({ value: season, label: season }))}
                  onChange={onSeasonChange}
                />
              )}
              {teams.length > 1 && onSelectTeam && (
                <SeasonDropdown
                  label="Välj lag"
                  value={selectedTeamId || selectedTeam?.id || ""}
                  options={teams.map((team) => ({ value: team.id, label: team.name }))}
                  onChange={handleTeamChange}
                />
              )}
              <SeasonDropdown
                label="Välj matchfilter"
                value={seasonScope}
                options={scopeOptions}
                onChange={setSeasonScope}
              />
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
                  Du kan se säsongen, men endast ägare kan ta bort matcher eller rensa säsongen.
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
              <SeasonDropdown
                label="Sortera spelare"
                value={seasonPlayerSort}
                onChange={setSeasonPlayerSort}
                options={[
                  { value: "name", label: "Namn A–Ö" },
                  { value: "matches", label: "Flest matcher" },
                  ...(seasonPlayerGroup === "field"
                    ? [
                        { value: "goals", label: "Flest mål" },
                        { value: "assists", label: "Flest assist" },
                        { value: "shotPct", label: "Högst skottprocent" }
                      ]
                    : []),
                  ...(seasonPlayerGroup === "goalkeepers"
                    ? [
                        { value: "saves", label: "Flest räddningar" },
                        { value: "savePct", label: "Högst räddningsprocent" }
                      ]
                    : [])
                ]}
              />
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
            <div className="bg-white border rounded-xl p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-lg font-extrabold text-slate-900">Matcher</div>
                  {filteredMatches.length !== scopedMatches.length && (
                    <div className="text-sm text-slate-500">
                      {filteredMatches.length} av {scopedMatches.length} matcher visas
                    </div>
                  )}
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <input
                    type="search"
                    value={seasonSearchMatches}
                    onChange={(e) => setSeasonSearchMatches(e.target.value)}
                    placeholder="Sök match"
                    className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm sm:w-64"
                    aria-label="Sök matcher"
                  />
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
                    <div ref={matchToolsRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setMatchToolsOpen((current) => !current)}
                        className={`flex h-10 w-10 items-center justify-center rounded-lg border text-xl font-bold text-slate-600 hover:bg-slate-100 ${
                          matchToolsOpen ? "border-sky-500 bg-sky-50" : "border-slate-300 bg-white"
                        }`}
                        aria-label="Matchmeny"
                        aria-haspopup="menu"
                        aria-expanded={matchToolsOpen}
                        title="Matchmeny"
                      >
                        ⋯
                      </button>
                      {matchToolsOpen && (
                        <div
                          role="menu"
                          aria-label="Matchmeny"
                          className="absolute right-0 top-11 z-30 w-64 rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMatchDeleteMode(true);
                              setSelectedMatchIdsForDelete([]);
                              setMatchToolsOpen(false);
                            }}
                            className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
                          >
                            Välj matcher att ta bort
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              {matchDeleteMode && (
                <div className="text-xs text-red-700 mt-2">
                  Välj matcherna som ska tas bort och tryck sedan på Ta bort valda.
                </div>
              )}
              {scopedMatches.length === 0 ? (
                <div className="text-sm text-slate-500 mt-3">Inga sparade matcher ännu.</div>
              ) : (
                <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
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
                      return (
                    <div
                      key={match.id}
                      className={`transition-colors ${
                        selectedForDelete ? "bg-red-50" : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-stretch gap-3">
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
                            className="my-auto h-5 w-5 shrink-0"
                            aria-label="Välj match för borttagning"
                          />
                        )}

                        <button
                          type="button"
                          disabled={matchDeleteMode}
                          onClick={() => {
                            setSeasonMatchPlayerFocus(null);
                            setSeasonMatchDetail(match);
                          }}
                          className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-left disabled:cursor-default"
                          aria-label={`Öppna match mot ${match.matchInfo?.opponent || "okänd motståndare"}`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                              <span>{match.matchInfo?.date || "-"}</span>
                              <span>•</span>
                              <span>{match.matchInfo?.location || "-"}</span>
                              <span>•</span>
                              <span className="truncate">
                                {match.matchType === "cup" ? match.cupName || "Cup" : "Serie"}
                              </span>
                            </div>
                            <div className="mt-1 truncate text-lg font-extrabold text-slate-900">
                              {match.matchInfo?.opponent || "Okänd motståndare"}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className={`text-xs font-bold ${diff > 0 ? "text-emerald-700" : diff < 0 ? "text-red-700" : "text-slate-600"}`}>
                                {outcome}
                              </div>
                              <div className="text-2xl font-extrabold tabular-nums text-slate-900">
                                {homeGoals}–{awayGoals}
                              </div>
                            </div>
                            {!matchDeleteMode && <span className="text-xl text-slate-400" aria-hidden="true">›</span>}
                          </div>
                        </button>
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
          <div className={`relative w-full rounded-2xl border bg-white shadow-2xl overflow-auto ${
            seasonMatchPlayerFocus
              ? "max-w-2xl max-h-[78vh] p-3 sm:p-4"
              : "max-w-3xl max-h-[85vh] p-4"
          }`}>
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
                  roster.find((p) => playerName && norm(p?.name) === norm(playerName)) ||
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

              const playerMatchRows = (scopedMatches || [])
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
                    assist: row.assist,
                    turnover: row.turnover,
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
                      (playerName && norm(name) === norm(playerName)) ||
                      (!playerName && playerNr && nr === normKey(playerNr))
                    );
                  });
                })
                .sort((a, b) => String(b.date).localeCompare(String(a.date), "sv"));

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
                  acc.assist += r.assist;
                  acc.turnover += r.turnover;
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
                  assist: 0,
                  turnover: 0,
                  attempts: 0
                }
              );

              const shotPct = pct(totals.totalGoals, totals.attempts);
              const gkPct = pct(totals.save, totals.save + totals.goal);
              const primaryStats = isGk
                ? [
                    { label: "Matcher", value: totals.matches },
                    { label: "Räddningar", value: totals.save },
                    { label: "Insläppta", value: totals.goal },
                    { label: "Rädd %", value: gkPct || "–" }
                  ]
                : [
                    { label: "Matcher", value: totals.matches },
                    { label: "Mål", value: totals.totalGoals },
                    { label: "Assist", value: totals.assist },
                    { label: "Skott %", value: shotPct || "–" }
                  ];
              const seasonDetailGroups = isGk
                ? [
                    {
                      title: "Spel",
                      items: [
                        { label: "Räddningar", value: totals.saveOpen },
                        { label: "Insläppta", value: totals.goalOpen }
                      ]
                    },
                    {
                      title: "7 meter",
                      items: [
                        { label: "Räddningar", value: totals.sevenMiss },
                        { label: "Insläppta", value: totals.sevenGoal }
                      ]
                    },
                    {
                      title: "Övrigt",
                      items: [
                        { label: "MV-mål", value: totals.gkScored },
                        { label: "Utvisningar", value: totals.suspension },
                        { label: "Gult", value: totals.yellowCard },
                        { label: "Rött", value: totals.redCard }
                      ]
                    }
                  ]
                : [
                    {
                      title: "Avslut",
                      items: [
                        { label: "Spelmål", value: totals.goalOpen },
                        { label: "7m mål", value: totals.sevenGoal },
                        { label: "7m miss", value: totals.sevenMiss },
                        { label: "Räddade", value: totals.save },
                        { label: "Utanför", value: totals.wide },
                        { label: "Ribba", value: totals.post }
                      ]
                    },
                    {
                      title: "Spel och bestraffningar",
                      items: [
                        { label: "Tekniska fel", value: totals.turnover },
                        { label: "Utvisningar", value: totals.suspension },
                        { label: "Gult", value: totals.yellowCard },
                        { label: "Rött", value: totals.redCard }
                      ]
                    }
                  ];

              return (
                <div className="mt-4 space-y-5">
                  <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {primaryStats.map((item) => (
                      <div key={item.label} className="rounded-lg bg-slate-100 px-3 py-3">
                        <dt className="text-xs font-semibold text-slate-500">{item.label}</dt>
                        <dd className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">{item.value}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {seasonDetailGroups.map((group) => (
                      <section key={group.title} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                        <h3 className="text-sm font-bold text-slate-800">{group.title}</h3>
                        <dl className="mt-2 divide-y divide-slate-100">
                          {group.items.map((item) => (
                            <div key={item.label} className="flex items-center justify-between gap-4 py-2 text-sm">
                              <dt className="text-slate-600">{item.label}</dt>
                              <dd className="font-bold tabular-nums text-slate-900">{item.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </section>
                    ))}
                  </div>

                  <section>
                    <h3 className="mb-2 text-sm font-bold text-slate-800">Matcher</h3>
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                      {playerMatchRows.map((r) => {
                        const m = r.match;
                        const gkP = pct(r.save, r.save + r.goal);
                        return (
                          <button
                            key={m.id || `${r.date}-${r.opponent}`}
                            type="button"
                            onClick={() => {
                              setSeasonMatchPlayerFocus({
                                id: seasonPlayerDetail?.playerId ?? seasonPlayerDetail?.id,
                                playerId: seasonPlayerDetail?.playerId ?? seasonPlayerDetail?.id,
                                nr: seasonPlayerDetail?.nr,
                                name: seasonPlayerDetail?.name,
                                type: seasonPlayerDetail?.type
                              });
                              setSeasonMatchDetail(m);
                            }}
                            className="grid w-full gap-3 px-3 py-3 text-left hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-slate-900">{r.opponent || "Okänd motståndare"}</div>
                              <div className="mt-0.5 text-xs text-slate-500">{r.date || "–"} • {r.location || "–"}</div>
                            </div>
                            <div className="flex items-center justify-between gap-4 sm:justify-end">
                              <div className="flex gap-4 text-center">
                                {isGk ? (
                                  <>
                                    <div><div className="text-[10px] font-semibold text-slate-500">Rädd</div><div className="text-sm font-bold tabular-nums">{r.save}</div></div>
                                    <div><div className="text-[10px] font-semibold text-slate-500">Insl.</div><div className="text-sm font-bold tabular-nums">{r.goal}</div></div>
                                    <div><div className="text-[10px] font-semibold text-slate-500">Rädd %</div><div className="text-sm font-bold tabular-nums">{gkP || "–"}</div></div>
                                  </>
                                ) : (
                                  <>
                                    <div><div className="text-[10px] font-semibold text-slate-500">Mål</div><div className="text-sm font-bold tabular-nums">{r.totalGoals}</div></div>
                                    <div><div className="text-[10px] font-semibold text-slate-500">Assist</div><div className="text-sm font-bold tabular-nums">{r.assist}</div></div>
                                    <div><div className="text-[10px] font-semibold text-slate-500">Skott %</div><div className="text-sm font-bold tabular-nums">{r.shotPct || "–"}</div></div>
                                  </>
                                )}
                              </div>
                              <div className="min-w-[3.5rem] text-right text-xl font-extrabold tabular-nums text-slate-900">{r.score}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
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
            aria-label={seasonPlayerDetail ? "Tillbaka" : "Stäng"}
          />
          <div className="relative bg-white w-full max-w-3xl rounded-2xl border shadow-2xl p-4 max-h-[85vh] overflow-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-500">
                  {seasonMatchDetail?.matchInfo?.date || "-"} • {seasonMatchDetail?.matchInfo?.location || "-"}
                </div>
                <div className="mt-0.5 truncate text-xl font-extrabold text-slate-900">
                  {seasonMatchDetail?.matchInfo?.opponent || "Okänd motståndare"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {seasonMatchDetail?.matchType === "cup"
                    ? `${seasonMatchDetail?.cupName || "Cup"}${seasonMatchDetail?.cupPhase ? ` • ${seasonMatchDetail.cupPhase}` : ""}`
                    : "Serie"}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                {onExportMatchExcel && !seasonMatchPlayerFocus && (
                  <button
                    type="button"
                    onClick={() => onExportMatchExcel(seasonMatchDetail)}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-sm font-semibold text-slate-700"
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
                  {seasonPlayerDetail ? "Tillbaka" : "Stäng"}
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
                  assist: row.assist,
                  turnover: row.turnover,
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
                ? rows.find(
                    (r) =>
                      (focusId && String(r.playerId ?? r.id ?? "") === focusId) ||
                      (focus?.name && norm(r.name) === norm(focus.name)) ||
                      `${normKey(r.nr)}|${normKey(r.name)}` === focusKey
                  )
                : null;

              if (focus && matchFocusRow) {
                const r = matchFocusRow;
                const isGK = r.isGoalkeeper;
                const gkPct = pct(r.saves, r.saves + r.goals);
                const fpPct = r.shotPct;
                const focusPrimaryStats = isGK
                  ? [
                      { label: "Räddningar", value: r.saves },
                      { label: "Insläppta", value: r.goals },
                      { label: "Rädd %", value: gkPct || "–" },
                      { label: "Skott mot mål", value: r.saves + r.goals }
                    ]
                  : [
                      { label: "Mål", value: r.totalGoals },
                      { label: "Assist", value: r.assist },
                      { label: "Avslut", value: r.attempts },
                      { label: "Skott %", value: fpPct || "–" }
                    ];
                const focusGroups = isGK
                  ? [
                      {
                        title: "Spel",
                        items: [
                          { label: "Räddningar", value: r.saveOpen },
                          { label: "Insläppta", value: r.goalOpen }
                        ]
                      },
                      {
                        title: "7 meter",
                        items: [
                          { label: "Räddningar", value: r.sevenMiss },
                          { label: "Insläppta", value: r.sevenGoal }
                        ]
                      },
                      {
                        title: "Övrigt",
                        items: [
                          { label: "MV-mål", value: r.gkScored },
                          { label: "Utanför", value: r.wide },
                          { label: "Ribba", value: r.post },
                          { label: "Utvisningar", value: r.suspension },
                          { label: "Gult", value: r.yellowCard },
                          { label: "Rött", value: r.redCard }
                        ]
                      }
                    ]
                  : [
                      {
                        title: "Avslut",
                        items: [
                          { label: "Spelmål", value: r.goals },
                          { label: "7m mål", value: r.sevenGoal },
                          { label: "7m miss", value: r.sevenMiss },
                          { label: "Räddade", value: r.saves },
                          { label: "Utanför", value: r.wide },
                          { label: "Ribba", value: r.post }
                        ]
                      },
                      {
                        title: "Spel och bestraffningar",
                        items: [
                          { label: "Tekniska fel", value: r.turnover },
                          { label: "Utvisningar", value: r.suspension },
                          { label: "Gult", value: r.yellowCard },
                          { label: "Rött", value: r.redCard }
                        ]
                      }
                    ];

                return (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-lg font-extrabold text-slate-900">#{r.nr} {r.name}</div>
                        <div className="text-xs text-slate-500">{isGK ? "Målvakt" : "Utespelare"}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSeasonMatchPlayerFocus(null)}
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Visa hela matchen
                      </button>
                    </div>

                    <dl className="grid grid-cols-4 gap-2">
                      {focusPrimaryStats.map((item) => (
                        <div key={item.label} className="min-w-0 rounded-lg bg-slate-100 px-2 py-2.5 sm:px-3">
                          <dt className="text-[11px] font-semibold leading-tight text-slate-500">{item.label}</dt>
                          <dd className="mt-1 text-xl font-extrabold tabular-nums text-slate-900">{item.value}</dd>
                        </div>
                      ))}
                    </dl>

                    <div className="grid grid-cols-2 gap-2">
                      {focusGroups.map((group, groupIndex) => (
                        <section
                          key={group.title}
                          className={`rounded-lg border border-slate-200 bg-white px-3 py-2.5 ${
                            focusGroups.length % 2 === 1 && groupIndex === focusGroups.length - 1 ? "col-span-2" : ""
                          }`}
                        >
                          <h3 className="text-sm font-bold text-slate-800">{group.title}</h3>
                          <dl className="mt-1 divide-y divide-slate-100">
                            {group.items.map((item) => (
                              <div key={item.label} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                                <dt className="text-slate-600">{item.label}</dt>
                                <dd className="font-bold tabular-nums text-slate-900">{item.value}</dd>
                              </div>
                            ))}
                          </dl>
                        </section>
                      ))}
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

              const isAwayMatch = String(seasonMatchDetail?.matchInfo?.location || "").toLowerCase() === "borta";
              const ourTeamName = selectedTeam?.name || "Vårt lag";
              const opponentName = seasonMatchDetail?.matchInfo?.opponent || "Motståndare";
              const homeTeamName = isAwayMatch ? opponentName : ourTeamName;
              const awayTeamName = isAwayMatch ? ourTeamName : opponentName;
              const homeGoals = Number(seasonMatchDetail?.result?.home ?? 0);
              const awayGoals = Number(seasonMatchDetail?.result?.away ?? 0);
              const matchQuickStats = getMatchQuickStats(seasonMatchDetail);
              const matchShotPct = matchQuickStats.attempts
                ? `${Math.round((matchQuickStats.goals / matchQuickStats.attempts) * 100)}%`
                : "–";

              return (
                <div className="mt-4 space-y-5">
                  <section className="rounded-lg bg-slate-900 px-4 py-4 text-white">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-slate-300">{homeTeamName}</div>
                        <div className="mt-1 text-4xl font-extrabold tabular-nums">{homeGoals}</div>
                      </div>
                      <div className="pb-1 text-3xl font-semibold text-slate-500">–</div>
                      <div className="min-w-0 text-right">
                        <div className="truncate text-xs font-semibold text-slate-300">{awayTeamName}</div>
                        <div className="mt-1 text-4xl font-extrabold tabular-nums">{awayGoals}</div>
                      </div>
                    </div>
                    <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-white/15 pt-3">
                      {[
                        { label: "Avslut", value: matchQuickStats.attempts },
                        { label: "Skott %", value: matchShotPct },
                        { label: "Räddn.", value: matchQuickStats.saves },
                        { label: "2 min", value: matchQuickStats.suspensions }
                      ].map((item) => (
                        <div key={item.label}>
                          <dt className="text-[11px] font-semibold text-slate-400">{item.label}</dt>
                          <dd className="mt-0.5 text-lg font-extrabold tabular-nums">{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>

                  {gks.length > 0 && (
                    <section>
                      <h3 className="mb-2 text-sm font-bold text-slate-800">Målvakter ({gks.length})</h3>
                      <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
                        {gks.map((r) => (
                          <button
                            key={r.playerId || r.id || r.name}
                            type="button"
                            onClick={() => setSeasonMatchPlayerFocus({ id: r.playerId ?? r.id, playerId: r.playerId ?? r.id, nr: r.nr, name: r.name, type: "gk" })}
                            className="grid w-full grid-cols-[minmax(0,1fr)_repeat(3,auto)_auto] items-center gap-3 bg-white px-3 py-3 text-left hover:bg-slate-50"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-slate-900">#{r.nr} {r.name}</div>
                              <div className="text-xs text-slate-500">Målvakt</div>
                            </div>
                            {[
                              ["Rädd", r.gkSaves],
                              ["Insl.", r.gkConceded],
                              ["Rädd %", r.gkPct || "–"]
                            ].map(([label, value]) => (
                              <div key={label} className="min-w-12 text-right">
                                <div className="text-[10px] font-semibold text-slate-400">{label}</div>
                                <div className="text-sm font-extrabold tabular-nums text-slate-900">{value}</div>
                              </div>
                            ))}
                            <span className="text-lg text-slate-400" aria-hidden="true">›</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  <section>
                    <h3 className="mb-2 text-sm font-bold text-slate-800">Utespelare ({fps.length})</h3>
                    <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
                      {fps.map((r) => (
                        <button
                          key={r.playerId || r.id || r.name}
                          type="button"
                          onClick={() => setSeasonMatchPlayerFocus({ id: r.playerId ?? r.id, playerId: r.playerId ?? r.id, nr: r.nr, name: r.name, type: "fp" })}
                          className="grid w-full grid-cols-[minmax(0,1fr)_repeat(3,auto)_auto] items-center gap-3 bg-white px-3 py-3 text-left hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-slate-900">#{r.nr} {r.name}</div>
                            <div className="text-xs text-slate-500">{r.assist} assist • {r.turnover} tekniska fel</div>
                          </div>
                          {[
                            ["Mål", r.totalGoals],
                            ["Avslut", r.attempts],
                            ["Skott %", r.shotPct || "–"]
                          ].map(([label, value]) => (
                            <div key={label} className="min-w-12 text-right">
                              <div className="text-[10px] font-semibold text-slate-400">{label}</div>
                              <div className="text-sm font-extrabold tabular-nums text-slate-900">{value}</div>
                            </div>
                          ))}
                          <span className="text-lg text-slate-400" aria-hidden="true">›</span>
                        </button>
                      ))}
                    </div>
                  </section>
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
