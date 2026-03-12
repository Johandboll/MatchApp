import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import teamsData from "./data/teams.json";
import WhatsNewModal from "./components/WhatsNewModal";
import TeamPicker from "./components/TeamPicker";
import MatchSetup from "./components/MatchSetup";
import MatchSession from "./components/MatchSession";
import SeasonCenter from "./components/SeasonCenter";
import { getChangelogTooltip } from "./changelog";
import { useWhatsNew } from "./hooks/useWhatsNew";
import { exportMatchExcel } from "./lib/exportMatchExcel";
import {
  APP_STATE_KEY,
  SEASON_STATE_KEY,
  SELECTED_TEAM_KEY,
  buildSeasonKpis,
  buildSeasonSummary,
  clearTeamQueryParam,
  emptyCounters,
  eventLabel,
  filterSeasonMatchesByTeam,
  loadSaved,
  loadSeasonMatches,
  sortPlayersForUI
} from "./lib/appHelpers";

const APP_VERSION = process.env.REACT_APP_VERSION || "0.0.0";
const CHANGELOG_TOOLTIP = getChangelogTooltip(APP_VERSION);

const EXTERNAL_TEAM_ID = "__external_team_file__";

function getTeamFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search);
    const team = (params.get("team") || "").toLowerCase();
    return team || null;
  } catch {
    return null;
  }
}

function getTeamFileFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("teamFile") || null;
  } catch {
    return null;
  }
}

function getClubReturnPathFromTeamFile(teamFile) {
  if (!teamFile) return null;

  try {
    const cleanPath = String(teamFile).split("?")[0].split("#")[0];
    const parts = cleanPath.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return `/${parts[0]}/`;
    }
  } catch {}

  return null;
}

export default function App() {
  const saved = useMemo(() => loadSaved(), []);
  const whatsNew = useWhatsNew();
  const toastTimeoutRef = useRef(null);

  const teamFileFromQuery = getTeamFileFromQuery();
  const clubReturnPath = getClubReturnPathFromTeamFile(teamFileFromQuery);
  const [externalTeamData, setExternalTeamData] = useState(null);
  const [externalTeamLoading, setExternalTeamLoading] = useState(Boolean(teamFileFromQuery));

  const [seasonMatches, setSeasonMatches] = useState(() => loadSeasonMatches());
  const [selectedTeamId, setSelectedTeamId] = useState(() => {
    const externalFile = getTeamFileFromQuery();
    if (externalFile) return EXTERNAL_TEAM_ID;

    const fromQuery = getTeamFromQuery();
    if (fromQuery) return fromQuery;
    try {
      return localStorage.getItem(SELECTED_TEAM_KEY) || null;
    } catch {
      return null;
    }
  });

  const [extraPlayers, setExtraPlayers] = useState(() => saved?.extraPlayers || []);
  const [cupEnabled, setCupEnabled] = useState(() => saved?.cupEnabled || false);
  const [cupName, setCupName] = useState(() => saved?.cupName || "");
  const [cupPhase, setCupPhase] = useState(() => saved?.cupPhase || "");
  const [extraPanelOpen, setExtraPanelOpen] = useState(() => saved?.extraPanelOpen ?? false);
  const [cupPanelOpen, setCupPanelOpen] = useState(
    () => saved?.cupPanelOpen ?? (saved?.cupEnabled ?? false)
  );
  const [selectedPlayers, setSelectedPlayers] = useState(() => saved?.selectedPlayers || []);
  const [step, setStep] = useState(() => saved?.step || 1);
  const [stats, setStats] = useState(() => saved?.stats || {});
  const [history, setHistory] = useState(() => {
    const items = saved?.history || [];
    return items.map((item) => {
      if (item && item.id) return item;
      return {
        ...(item || {}),
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        time: Date.now()
      };
    });
  });
  const [matchInfo, setMatchInfo] = useState(
    () => saved?.matchInfo || { date: "", opponent: "", location: "" }
  );
  const [currentHalf, setCurrentHalf] = useState(() => saved?.currentHalf || 1);
  const [viewMode, setViewMode] = useState(() => saved?.viewMode || "match");
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const selectedTeam = useMemo(() => {
    if (selectedTeamId === EXTERNAL_TEAM_ID) return externalTeamData;
    return teamsData.find((team) => team.id === selectedTeamId) || null;
  }, [selectedTeamId, externalTeamData]);

  const basePlayers = useMemo(() => {
    if (selectedTeam && Array.isArray(selectedTeam.players) && selectedTeam.players.length > 0) {
      return selectedTeam.players;
    }
    return [];
  }, [selectedTeam]);

  const allPlayers = useMemo(() => {
    const normalize = (player) => ({
      nr: typeof player.nr === "number" ? player.nr : Number(player.nr),
      name: String(player.name || "").trim(),
      role: player.role === "goalkeeper" ? "goalkeeper" : undefined
    });
    return [...basePlayers, ...extraPlayers.map(normalize)];
  }, [basePlayers, extraPlayers]);

  const playersForUI = useMemo(() => sortPlayersForUI(allPlayers), [allPlayers]);
  const seasonMatchesForView = useMemo(
    () => filterSeasonMatchesByTeam(seasonMatches, selectedTeamId),
    [seasonMatches, selectedTeamId]
  );

  const seasonSummary = useMemo(
    () => buildSeasonSummary(seasonMatchesForView, teamsData),
    [seasonMatchesForView]
  );
  const seasonKpis = useMemo(
    () => buildSeasonKpis(seasonMatchesForView, seasonSummary.fieldPlayers),
    [seasonMatchesForView, seasonSummary.fieldPlayers]
  );

  const cupLabel = useMemo(() => {
    const active = (cupEnabled || cupPanelOpen) && (cupName || "").trim();
    return active ? `${cupName.trim()}${cupPhase ? ` (${cupPhase})` : ""}` : "";
  }, [cupEnabled, cupPanelOpen, cupName, cupPhase]);

  const showToast = useCallback((text) => {
    setToast({ text });
    window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 2000);
  }, []);

  useEffect(() => {
    try {
      if (selectedTeamId && selectedTeamId !== EXTERNAL_TEAM_ID) {
        localStorage.setItem(SELECTED_TEAM_KEY, selectedTeamId);
      }
    } catch {}
  }, [selectedTeamId]);

  useEffect(() => {
    if (!teamFileFromQuery) {
      setExternalTeamData(null);
      setExternalTeamLoading(false);
      return;
    }

    let cancelled = false;

    const loadExternalTeam = async () => {
      try {
        setExternalTeamLoading(true);
        const response = await fetch(teamFileFromQuery);
        if (!response.ok) {
          throw new Error(`Kunde inte läsa lagfilen: ${teamFileFromQuery}`);
        }

        const data = await response.json();
        const mappedPlayers = Array.isArray(data?.players)
          ? data.players.map((player) => ({
              nr: Number(player.number),
              name: String(player.name || "").trim(),
              role: player.type === "goalkeeper" ? "goalkeeper" : undefined
            }))
          : [];

        if (!cancelled) {
          setExternalTeamData({
            id: EXTERNAL_TEAM_ID,
            name: data?.teamName || "Externt lag",
            players: mappedPlayers
          });
          setSelectedTeamId(EXTERNAL_TEAM_ID);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setExternalTeamData({
            id: EXTERNAL_TEAM_ID,
            name: "Externt lag",
            players: []
          });
          setSelectedTeamId(EXTERNAL_TEAM_ID);
        }
      } finally {
        if (!cancelled) {
          setExternalTeamLoading(false);
        }
      }
    };

    loadExternalTeam();

    return () => {
      cancelled = true;
    };
  }, [teamFileFromQuery]);

  useEffect(() => {
    try {
      localStorage.setItem(SEASON_STATE_KEY, JSON.stringify(seasonMatches));
    } catch {}
  }, [seasonMatches]);

  const persist = useCallback(() => {
    localStorage.setItem(
      APP_STATE_KEY,
      JSON.stringify({
        selectedPlayers,
        step,
        stats,
        matchInfo,
        history,
        currentHalf,
        viewMode,
        extraPlayers,
        cupEnabled,
        cupName,
        cupPhase,
        extraPanelOpen,
        cupPanelOpen
      })
    );
  }, [
    selectedPlayers,
    step,
    stats,
    matchInfo,
    history,
    currentHalf,
    viewMode,
    extraPlayers,
    cupEnabled,
    cupName,
    cupPhase,
    extraPanelOpen,
    cupPanelOpen
  ]);

  useEffect(() => {
    persist();
  }, [persist]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (step === 2 && history.length > 0) {
        persist();
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [step, history.length, persist]);

  useEffect(() => {
    return () => window.clearTimeout(toastTimeoutRef.current);
  }, []);

  const ensurePlayerStats = useCallback((nr) => {
    setStats((prev) => {
      const current = prev[nr];
      if (current && current.byHalf) return prev;
      const base = current || emptyCounters();
      return {
        ...prev,
        [nr]: {
          ...emptyCounters(),
          ...base,
          byHalf: {
            1: { ...(base.byHalf?.[1] || emptyCounters()) },
            2: { ...(base.byHalf?.[2] || emptyCounters()) }
          }
        }
      };
    });
  }, []);

  const togglePlayer = useCallback((nr) => {
    setSelectedPlayers((prev) =>
      prev.includes(nr) ? prev.filter((item) => item !== nr) : [...prev, nr]
    );
  }, []);

  const handleMatchInfoChange = useCallback((event) => {
    const { name, value } = event.target;
    setMatchInfo((prev) => ({ ...prev, [name]: value }));
  }, []);

  const addExtraPlayer = useCallback(
    (player) => {
      const nrNum = Number(player.nr);
      if (!nrNum || !player.name?.trim()) {
        alert("Fyll i både nummer och namn.");
        return false;
      }
      const exists = allPlayers.some((item) => String(item.nr) === String(nrNum));
      if (exists) {
        alert("Det finns redan en spelare med det numret.");
        return false;
      }
      setExtraPlayers((prev) => [
        ...prev,
        {
          nr: nrNum,
          name: player.name.trim(),
          role: player.role === "goalkeeper" ? "goalkeeper" : undefined
        }
      ]);
      return true;
    },
    [allPlayers]
  );

  const removeExtraPlayer = useCallback((nr) => {
    setExtraPlayers((prev) => prev.filter((player) => String(player.nr) !== String(nr)));
    setSelectedPlayers((prev) => prev.filter((item) => String(item) !== String(nr)));
  }, []);

  const clearExtraPlayers = useCallback(() => {
    if (window.confirm("Rensa alla extra spelare?")) {
      setExtraPlayers([]);
      setSelectedPlayers((prev) =>
        prev.filter((nr) => basePlayers.some((player) => String(player.nr) === String(nr)))
      );
    }
  }, [basePlayers]);

  const startMatch = useCallback(() => {
    if (!matchInfo?.date || !matchInfo?.opponent || !matchInfo?.location) {
      alert("Fyll i datum, motståndare och Hemma/Borta innan du startar matchen.");
      return;
    }

    if (selectedPlayers.length === 0) {
      alert("Välj minst en spelare");
      return;
    }

    const initialStats = {};
    selectedPlayers.forEach((nr) => {
      initialStats[nr] = {
        ...emptyCounters(),
        byHalf: { 1: emptyCounters(), 2: emptyCounters() }
      };
    });
    setStats(initialStats);
    setCurrentHalf(1);
    setStep(2);
    setViewMode("match");
  }, [matchInfo, selectedPlayers]);

  const increment = useCallback(
    (nr, type) => {
      ensurePlayerStats(nr);

      const player = allPlayers.find((item) => String(item.nr) === String(nr));
      const isGoalkeeper = player?.role === "goalkeeper";

      let alsoType = null;
      if (isGoalkeeper && type === "sevenGoal") alsoType = "goal";
      if (isGoalkeeper && type === "sevenMiss") alsoType = "save";

      setStats((prev) => {
        const playerStats = prev[nr] || {
          ...emptyCounters(),
          byHalf: { 1: emptyCounters(), 2: emptyCounters() }
        };
        const byHalf = playerStats.byHalf || { 1: emptyCounters(), 2: emptyCounters() };
        const incOne = (obj, key) => ({ ...obj, [key]: (obj[key] || 0) + 1 });

        let next = {
          ...playerStats,
          ...incOne(playerStats, type),
          byHalf: {
            ...byHalf,
            [currentHalf]: incOne(byHalf[currentHalf] || {}, type)
          }
        };

        if (alsoType) {
          next = {
            ...next,
            ...incOne(next, alsoType),
            byHalf: {
              ...next.byHalf,
              [currentHalf]: incOne(next.byHalf[currentHalf] || {}, alsoType)
            }
          };
        }

        return { ...prev, [nr]: next };
      });

      setHistory((prev) => [
        ...prev,
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          time: Date.now(),
          nr,
          type,
          alsoType,
          half: currentHalf
        }
      ]);

      showToast(`#${nr} ${player?.name || ""} – ${eventLabel(type, player)}`);
    },
    [allPlayers, currentHalf, ensurePlayerStats, showToast]
  );

  const undoLast = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];

    setStats((prev) => {
      const playerStats = prev[last.nr];
      if (!playerStats) return prev;

      const byHalf = { ...(playerStats.byHalf || { 1: emptyCounters(), 2: emptyCounters() }) };
      const half = last.half || currentHalf;
      const dec = (obj, key) => Math.max(0, (obj[key] || 0) - 1);

      let next = {
        ...playerStats,
        [last.type]: dec(playerStats, last.type),
        byHalf: {
          ...byHalf,
          [half]: {
            ...(byHalf[half] || {}),
            [last.type]: dec(byHalf[half] || {}, last.type)
          }
        }
      };

      if (last.alsoType) {
        next = {
          ...next,
          [last.alsoType]: dec(next, last.alsoType),
          byHalf: {
            ...next.byHalf,
            [half]: {
              ...(next.byHalf[half] || {}),
              [last.alsoType]: dec(next.byHalf[half] || {}, last.alsoType)
            }
          }
        };
      }

      return { ...prev, [last.nr]: next };
    });

    setHistory((prev) => prev.slice(0, -1));
    const player = allPlayers.find((item) => String(item.nr) === String(last.nr));
    showToast(`Ångrade: #${last.nr} ${player?.name || ""} – ${eventLabel(last.type, player)}`);
  }, [allPlayers, currentHalf, history, showToast]);

  const deleteHistoryItem = useCallback(
    (id) => {
      const item = history.find((entry) => entry.id === id);
      if (!item) return;

      setStats((prev) => {
        const playerStats = prev[item.nr];
        if (!playerStats) return prev;

        const byHalf = { ...(playerStats.byHalf || { 1: emptyCounters(), 2: emptyCounters() }) };
        const half = item.half || currentHalf;
        const dec = (obj, key) => Math.max(0, (obj[key] || 0) - 1);

        let next = {
          ...playerStats,
          [item.type]: dec(playerStats, item.type),
          byHalf: {
            ...byHalf,
            [half]: {
              ...(byHalf[half] || {}),
              [item.type]: dec(byHalf[half] || {}, item.type)
            }
          }
        };

        if (item.alsoType) {
          next = {
            ...next,
            [item.alsoType]: dec(next, item.alsoType),
            byHalf: {
              ...next.byHalf,
              [half]: {
                ...(next.byHalf[half] || {}),
                [item.alsoType]: dec(next.byHalf[half] || {}, item.alsoType)
              }
            }
          };
        }

        return { ...prev, [item.nr]: next };
      });

      setHistory((prev) => prev.filter((entry) => entry.id !== id));
      const player = allPlayers.find((entry) => String(entry.nr) === String(item.nr));
      showToast(`Raderade: #${item.nr} ${player?.name || ""} – ${eventLabel(item.type, player)}`);
    },
    [allPlayers, currentHalf, history, showToast]
  );

  const computeFinalScore = useCallback(
    (statsObj) => {
      let ourGoals = 0;
      let oppGoals = 0;

      Object.entries(statsObj || {}).forEach(([nr, playerStats]) => {
        const player = allPlayers.find((item) => String(item.nr) === String(nr));
        if (!player) return;

        if (player.role === "goalkeeper") {
          oppGoals += playerStats.goal || 0;
          ourGoals += playerStats.gkScored || 0;
        } else {
          ourGoals += (playerStats.goal || 0) + (playerStats.sevenGoal || 0);
        }
      });

      const isHomeMatch = (matchInfo?.location || "") === "Hemma";
      return {
        home: isHomeMatch ? ourGoals : oppGoals,
        away: isHomeMatch ? oppGoals : ourGoals
      };
    },
    [allPlayers, matchInfo?.location]
  );

  const saveCurrentMatchToSeason = useCallback(() => {
    const result = computeFinalScore(stats);
    const matchRecord = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      teamId: selectedTeamId,
      teamName: selectedTeam?.name || "",
      matchInfo: { ...matchInfo },
      result,
      selectedPlayers: [...selectedPlayers],
      playerRoster: [...selectedPlayers]
        .map((nr) => {
          const player = allPlayers.find((item) => String(item.nr) === String(nr));
          return {
            nr: Number(nr),
            name: player?.name || "",
            role: player?.role === "goalkeeper" ? "goalkeeper" : undefined
          };
        })
        .filter((player) => Number.isFinite(Number(player.nr))),
      stats: JSON.parse(JSON.stringify(stats || {})),
      history: JSON.parse(JSON.stringify(history || []))
    };

    setSeasonMatches((prev) => {
      const alreadySaved = prev.some((match) => {
        return (
          match.teamId === matchRecord.teamId &&
          match.matchInfo?.date === matchRecord.matchInfo?.date &&
          match.matchInfo?.opponent === matchRecord.matchInfo?.opponent &&
          match.matchInfo?.location === matchRecord.matchInfo?.location &&
          JSON.stringify(match.result || {}) === JSON.stringify(matchRecord.result || {})
        );
      });

      if (alreadySaved) {
        showToast("Matchen finns redan sparad i säsongen");
        return prev;
      }

      showToast("Match sparad i säsongen");
      return [...prev, matchRecord];
    });
  }, [
    allPlayers,
    computeFinalScore,
    history,
    matchInfo,
    selectedPlayers,
    selectedTeam,
    selectedTeamId,
    showToast,
    stats
  ]);

  const confirmReset = useCallback(() => {
    if (step === 2 && (history.length > 0 || Object.keys(stats || {}).length > 0)) {
      const message = `Spara matchen (${matchInfo?.date || "-"} vs ${matchInfo?.opponent || "-"}) i säsongen innan du startar ny match?`;
      if (window.confirm(message)) {
        saveCurrentMatchToSeason();
      }
    }

    setStats({});
    setHistory([]);
    setSelectedPlayers([]);
    setMatchInfo({ date: "", opponent: "", location: "" });
    setCurrentHalf(1);
    setViewMode("match");
    setStep(1);

    localStorage.setItem(
      APP_STATE_KEY,
      JSON.stringify({
        selectedPlayers: [],
        step: 1,
        stats: {},
        matchInfo: { date: "", opponent: "", location: "" },
        history: [],
        currentHalf: 1,
        viewMode: "match",
        extraPlayers,
        cupEnabled,
        cupName,
        cupPhase,
        extraPanelOpen,
        cupPanelOpen
      })
    );

    window.scrollTo(0, 0);
  }, [
    cupEnabled,
    cupName,
    cupPanelOpen,
    cupPhase,
    extraPanelOpen,
    extraPlayers,
    history.length,
    matchInfo,
    saveCurrentMatchToSeason,
    stats,
    step
  ]);

  const exportSeasonJson = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      teamId: selectedTeamId || null,
      teamName: selectedTeam?.name || null,
      matches: seasonMatchesForView
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const teamPart =
      (selectedTeam?.name || selectedTeamId || "season")
        .toString()
        .replace(/[^\p{L}\p{N}\-_ ]/gu, "")
        .trim() || "season";
    link.href = url;
    link.download = `matchapp_season_${teamPart}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Säsong (JSON) nedladdad");
  }, [seasonMatchesForView, selectedTeam, selectedTeamId, showToast]);

  const downloadExcel = useCallback(async () => {
    await exportMatchExcel({
      matchInfo,
      cupEnabled,
      cupPanelOpen,
      cupName,
      cupPhase,
      allPlayers,
      selectedPlayers,
      stats
    });
  }, [allPlayers, cupEnabled, cupName, cupPanelOpen, cupPhase, matchInfo, selectedPlayers, stats]);

  const handleDeleteSeasonMatch = useCallback(
    (matchId) => {
      setSeasonMatches((prev) => prev.filter((match) => match.id !== matchId));
      showToast("Match borttagen");
    },
    [showToast]
  );

  const handleClearSeason = useCallback(() => {
    if (seasonMatchesForView.length === 0) {
      showToast("Säsongen är redan tom");
      return;
    }

    if (selectedTeamId) {
      setSeasonMatches((prev) => prev.filter((match) => match.teamId !== selectedTeamId));
    } else {
      setSeasonMatches([]);
    }

    showToast("Säsongen rensad");
    setSeasonOpen(false);
  }, [seasonMatchesForView.length, selectedTeamId, showToast]);

  const handleChangeTeam = useCallback(() => {
    if (window.confirm("Vill du byta lag? All matchdata raderas.")) {
      localStorage.removeItem(SELECTED_TEAM_KEY);
      setExternalTeamData(null);

      if (teamFileFromQuery && clubReturnPath) {
        window.location.href = clubReturnPath;
        return;
      }

      clearTeamQueryParam();
      window.location.reload();
    }
  }, [clubReturnPath, teamFileFromQuery]);

  const canStartMatch =
    Boolean(matchInfo?.date) && Boolean(matchInfo?.opponent) && Boolean(matchInfo?.location);

  const liveScore = useMemo(() => {
    let our = 0;
    let opp = 0;

    Object.entries(stats).forEach(([nr, playerStats]) => {
      const player = allPlayers.find((item) => String(item.nr) === String(nr));
      if (!player) return;

      if (player.role === "goalkeeper") {
        opp += playerStats.goal || 0;
        our += playerStats.gkScored || 0;
      } else {
        our += (playerStats.goal || 0) + (playerStats.sevenGoal || 0);
      }
    });

    return { our, opp };
  }, [allPlayers, stats]);

  const isHome = (matchInfo?.location || "") === "Hemma";
  const topbarLiveHome = isHome ? liveScore.our : liveScore.opp;
  const topbarLiveAway = isHome ? liveScore.opp : liveScore.our;

  if (externalTeamLoading) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <h2 className="text-xl font-semibold mb-4">Laddar lag...</h2>
      </div>
    );
  }

  if (!selectedTeamId) {
    return <TeamPicker teams={teamsData} appVersion={APP_VERSION} onSelectTeam={setSelectedTeamId} />;
  }

  return (
    <div className="p-4 max-w-7xl mx-auto relative">
      {(step === 1 || (step === 2 && selectedPlayers.length === 0)) && (
        <MatchSetup
          matchInfo={matchInfo}
          onMatchInfoChange={handleMatchInfoChange}
          onOpenSeason={() => setSeasonOpen(true)}
          playersForUI={playersForUI}
          selectedPlayers={selectedPlayers}
          onTogglePlayer={togglePlayer}
          cupPanelOpen={cupPanelOpen}
          setCupPanelOpen={setCupPanelOpen}
          setCupEnabled={setCupEnabled}
          cupName={cupName}
          setCupName={setCupName}
          cupPhase={cupPhase}
          setCupPhase={setCupPhase}
          extraPanelOpen={extraPanelOpen}
          setExtraPanelOpen={setExtraPanelOpen}
          extraPlayers={extraPlayers}
          onAddExtraPlayer={addExtraPlayer}
          onRemoveExtraPlayer={removeExtraPlayer}
          onClearExtraPlayers={clearExtraPlayers}
          onStartMatch={startMatch}
          canStartMatch={canStartMatch}
          onChangeTeam={handleChangeTeam}
          appVersion={APP_VERSION}
          changelogTooltip={CHANGELOG_TOOLTIP}
        />
      )}

      {step === 2 && selectedPlayers.length > 0 && (
        <MatchSession
          currentHalf={currentHalf}
          setCurrentHalf={setCurrentHalf}
          viewMode={viewMode}
          setViewMode={setViewMode}
          undoLast={undoLast}
          onDownloadExcel={downloadExcel}
          onReset={confirmReset}
          matchInfo={matchInfo}
          liveHome={topbarLiveHome}
          liveAway={topbarLiveAway}
          cupLabel={cupLabel}
          onOpenSeason={() => setSeasonOpen(true)}
          history={history}
          allPlayers={allPlayers}
          onDeleteHistoryItem={deleteHistoryItem}
          selectedPlayers={selectedPlayers}
          stats={stats}
          increment={increment}
          playersForUI={playersForUI}
        />
      )}

      <SeasonCenter
        open={seasonOpen}
        selectedTeam={selectedTeam}
        seasonKpis={seasonKpis}
        onExportBackup={exportSeasonJson}
        onClose={() => setSeasonOpen(false)}
        seasonSummary={seasonSummary}
        matches={seasonMatchesForView}
        onDeleteMatch={handleDeleteSeasonMatch}
        onClearSeason={handleClearSeason}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 bg-green-600 text-white px-4 py-2 rounded-xl shadow-lg"
        >
          {toast.text}
        </div>
      )}

      <WhatsNewModal
        open={whatsNew.open}
        title={`Vad är nytt i MatchApp ${whatsNew.version}?`}
        items={whatsNew.items}
        onClose={whatsNew.close}
      />
    </div>
  );
}
