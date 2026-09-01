import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import teamsData from "./data/teams.json";
import AuthView from "./components/AuthView";
import WhatsNewModal from "./components/WhatsNewModal";
import TeamPicker from "./components/TeamPicker";
import MatchSetup from "./components/MatchSetup";
import MatchSession from "./components/MatchSession";
import SeasonCenter from "./components/SeasonCenter";
import TeamAdminPanel from "./components/TeamAdminPanel";
import SystemAdminPanel from "./components/SystemAdminPanel";
import ConfirmDialog from "./components/ConfirmDialog";
import AppUpdatePrompt from "./components/AppUpdatePrompt";
import PrivacyNoticeModal, { PRIVACY_NOTICE_VERSION } from "./components/PrivacyNoticeModal";
import HelpModal from "./components/HelpModal";
import StartupSplash from "./components/StartupSplash";
import { getChangelogTooltip } from "./changelog";
import { APP_VERSION } from "./config/appVersion";
import { useAppUpdate } from "./hooks/useAppUpdate";
import { useAccountAccess } from "./hooks/useAccountAccess";
import { useSupabaseAuth } from "./hooks/useSupabaseAuth";
import { useSupabaseMatches } from "./hooks/useSupabaseMatches";
import { useSupabaseTeams } from "./hooks/useSupabaseTeams";
import { useTeamSeasons } from "./hooks/useTeamSeasons";
import { useWhatsNew } from "./hooks/useWhatsNew";
import { exportMatchExcel } from "./lib/exportMatchExcel";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import {
  APP_STATE_KEY,
  SEASON_STATE_KEY,
  SELECTED_SEASON_KEY,
  SELECTED_TEAM_KEY,
  buildSeasonOptions,
  buildSeasonKpis,
  buildSeasonSummary,
  emptyCounters,
  eventLabel,
  filterSeasonMatchesByTeam,
  getDefaultSeason,
  getSeasonFromDate,
  isActiveMatchTeamUnavailable,
  getMatchSeason,
  getSeasonStartYear,
  loadSaved,
  loadSeasonMatches,
  normalizeSeason,
  shouldWaitForOnlineTeams,
  sortPlayersForUI
} from "./lib/appHelpers";
import { storageKey } from "./lib/storageKeys";

const CHANGELOG_TOOLTIP = getChangelogTooltip(APP_VERSION);

const EXTERNAL_TEAM_ID = "__external_team_file__";
const PENDING_ONLINE_MATCHES_KEY = storageKey("pending-online-matches");
const PRIVACY_NOTICE_KEY = storageKey("privacy-notice");
const OFFLINE_READY_KEY = storageKey("offline-ready-version");
const STARTUP_INTRO_MS = 950;
const PRIVACY_NOTICE_COLUMNS_MISSING = "42703";
const slugifyPlayerPart = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "player";

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

function loadPendingOnlineMatches() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_ONLINE_MATCHES_KEY)) || [];
  } catch {
    return [];
  }
}

function savePendingOnlineMatches(matches) {
  try {
    localStorage.setItem(PENDING_ONLINE_MATCHES_KEY, JSON.stringify(matches));
  } catch {}
}

function getPrivacyNoticeStorageKey(user) {
  return `${PRIVACY_NOTICE_KEY}:${user?.id || user?.email || "local"}`;
}

function hasSeenPrivacyNotice(user) {
  try {
    return localStorage.getItem(getPrivacyNoticeStorageKey(user)) === PRIVACY_NOTICE_VERSION;
  } catch {
    return true;
  }
}

function markPrivacyNoticeSeen(user) {
  try {
    localStorage.setItem(getPrivacyNoticeStorageKey(user), PRIVACY_NOTICE_VERSION);
  } catch {}
}

async function hasSeenPrivacyNoticeInSupabase(user) {
  if (!supabase || !user?.id) return hasSeenPrivacyNotice(user);

  const { data, error } = await supabase
    .from("profiles")
    .select("privacy_notice_version")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    if (error.code !== PRIVACY_NOTICE_COLUMNS_MISSING) {
      console.warn("Kunde inte läsa integritetsinformation:", error.message);
    }
    return hasSeenPrivacyNotice(user);
  }

  return data?.privacy_notice_version === PRIVACY_NOTICE_VERSION;
}

async function markPrivacyNoticeSeenInSupabase(user) {
  markPrivacyNoticeSeen(user);
  if (!supabase || !user?.id) return;

  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: user.id,
        email: user.email || null,
        privacy_notice_version: PRIVACY_NOTICE_VERSION,
        privacy_notice_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.warn("Kunde inte spara integritetsinformation:", error.message);
  }
}

export default function App() {
  const auth = useSupabaseAuth();
  const onlineTeams = useSupabaseTeams(auth.user);
  const accountAccess = useAccountAccess(auth.user);
  const appUpdate = useAppUpdate();
  const saved = useMemo(() => loadSaved(), []);
  const whatsNew = useWhatsNew();
  const toastTimeoutRef = useRef(null);
  const [startupIntroVisible, setStartupIntroVisible] = useState(true);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false
  );
  const [offlineReady, setOfflineReady] = useState(() => {
    try {
      return localStorage.getItem(OFFLINE_READY_KEY) === APP_VERSION;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setStartupIntroVisible(false), STARTUP_INTRO_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleOfflineReady = () => setOfflineReady(true);
    window.addEventListener("matchapp:offline-ready", handleOfflineReady);
    return () => window.removeEventListener("matchapp:offline-ready", handleOfflineReady);
  }, []);

  const teamFileFromQuery = getTeamFileFromQuery();
  const [externalTeamData, setExternalTeamData] = useState(null);
  const [externalTeamLoading, setExternalTeamLoading] = useState(Boolean(teamFileFromQuery));
  const [selectedSeason, setSelectedSeason] = useState(() => {
    const defaultSeason = getDefaultSeason();
    try {
      const savedSeason = localStorage.getItem(SELECTED_SEASON_KEY);
      if (!savedSeason) return defaultSeason;
      return getSeasonStartYear(savedSeason) < getSeasonStartYear(defaultSeason) ? defaultSeason : savedSeason;
    } catch {
      return defaultSeason;
    }
  });

  const [seasonMatches, setSeasonMatches] = useState(() => loadSeasonMatches());
  const [selectedTeamId, setSelectedTeamId] = useState(() => {
    const externalFile = getTeamFileFromQuery();
    if (externalFile) return EXTERNAL_TEAM_ID;

    const fromQuery = getTeamFromQuery();
    if (fromQuery) return fromQuery;
    try {
      return (saved?.step === 2 && saved?.activeMatchTeamId) || localStorage.getItem(SELECTED_TEAM_KEY) || null;
    } catch {
      return null;
    }
  });

  const [cupEnabled, setCupEnabled] = useState(() => saved?.cupEnabled || false);
  const [cupName, setCupName] = useState(() => saved?.cupName || "");
  const [cupPhase, setCupPhase] = useState(() => saved?.cupPhase || "");
  const [cupPanelOpen, setCupPanelOpen] = useState(
    () => saved?.cupPanelOpen ?? (saved?.cupEnabled ?? false)
  );
  const [selectedPlayers, setSelectedPlayers] = useState(() => saved?.selectedPlayers || []);
  const [activeMatchTeamId, setActiveMatchTeamId] = useState(() => {
    if (saved?.activeMatchTeamId) return saved.activeMatchTeamId;
    if (saved?.step !== 2) return null;
    try {
      return localStorage.getItem(SELECTED_TEAM_KEY) || null;
    } catch {
      return null;
    }
  });
  const [matchRoster, setMatchRoster] = useState(() => saved?.matchRoster || []);
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
  const [seasonStatsSelection, setSeasonStatsSelection] = useState(() => getDefaultSeason());
  const [helpOpen, setHelpOpen] = useState(false);
  const [teamAdminOpen, setTeamAdminOpen] = useState(false);
  const [systemAdminOpen, setSystemAdminOpen] = useState(false);
  const [privacyNoticeOpen, setPrivacyNoticeOpen] = useState(false);
  const [privacyNoticeRequired, setPrivacyNoticeRequired] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [pendingOnlineMatches, setPendingOnlineMatches] = useState(() => loadPendingOnlineMatches());

  const availableTeams = useMemo(() => {
    if (isSupabaseConfigured && auth.user) return onlineTeams.teams;
    return teamsData;
  }, [auth.user, onlineTeams.teams]);

  const selectedTeamRecord = useMemo(() => {
    if (selectedTeamId === EXTERNAL_TEAM_ID) return externalTeamData;
    return availableTeams.find((team) => team.id === selectedTeamId) || null;
  }, [availableTeams, selectedTeamId, externalTeamData]);

  const onlineTeamSeasons = useTeamSeasons(auth.user, selectedTeamRecord, selectedSeason);
  const selectedTeam = useMemo(() => {
    const seasonName = onlineTeamSeasons.activeTeamSeason?.display_name?.trim();
    return seasonName && selectedTeamRecord
      ? { ...selectedTeamRecord, name: seasonName }
      : selectedTeamRecord;
  }, [onlineTeamSeasons.activeTeamSeason, selectedTeamRecord]);
  useEffect(() => {
    const displayName = onlineTeamSeasons.activeTeamSeason?.display_name?.trim();
    if (!displayName || !selectedTeamRecord || selectedTeamRecord.name === displayName) return;
    onlineTeams.setTeams((current) => current.map((team) =>
      team.id === selectedTeamRecord.id
        ? { ...team, legacyName: team.legacyName || team.name, name: displayName }
        : team
    ));
  }, [onlineTeamSeasons.activeTeamSeason, onlineTeams, selectedTeamRecord]);
  const seasonCenterTeam = useMemo(() => {
    if (!selectedTeamRecord) return null;
    if (seasonStatsSelection === "all") return selectedTeam;
    const season = onlineTeamSeasons.seasons.find((item) => item.season_name === seasonStatsSelection);
    const seasonName = season?.display_name?.trim();
    const fallbackName = selectedTeamRecord.legacyName || selectedTeamRecord.name;
    return { ...selectedTeamRecord, name: seasonName || fallbackName };
  }, [onlineTeamSeasons.seasons, seasonStatsSelection, selectedTeam, selectedTeamRecord]);

  const activeMatchTeamUnavailable = isActiveMatchTeamUnavailable({
    step,
    activeMatchTeamId,
    availableTeams,
    teamsLoading: onlineTeams.loading
  });

  useEffect(() => {
    if (selectedTeamId === EXTERNAL_TEAM_ID || teamFileFromQuery) return;
    if (shouldWaitForOnlineTeams({
      supabaseConfigured: isSupabaseConfigured,
      authLoading: auth.loading,
      user: auth.user,
      teamsReady: onlineTeams.ready
    })) return;
    if (selectedTeamId && selectedTeam) return;

    // Never move an ongoing match to another team while memberships are loading.
    if (step === 2 && activeMatchTeamId) {
      if (activeMatchTeamUnavailable) return;
      if (selectedTeamId !== activeMatchTeamId) setSelectedTeamId(activeMatchTeamId);
      return;
    }

    if (availableTeams.length > 0) {
      setSelectedTeamId(availableTeams[0].id);
      return;
    }

    if (isSupabaseConfigured && auth.user && !onlineTeams.loading && selectedTeamId) {
      setSelectedTeamId(null);
    }
  }, [activeMatchTeamId, activeMatchTeamUnavailable, auth.loading, auth.user, availableTeams, onlineTeams.loading, onlineTeams.ready, selectedTeam, selectedTeamId, step, teamFileFromQuery]);

  const canDeleteFromSelectedTeam =
    !selectedTeam?.onlineId || selectedTeam?.membershipRole === "owner";
  const onlineMatches = useSupabaseMatches(auth.user, selectedTeam);

  useEffect(() => {
    let cancelled = false;

    if (!isSupabaseConfigured || !auth.user) {
      setPrivacyNoticeRequired(false);
      setPrivacyNoticeOpen(false);
      return undefined;
    }

    const checkPrivacyNotice = async () => {
      const seen = await hasSeenPrivacyNoticeInSupabase(auth.user);
      if (cancelled) return;

      if (!seen) {
        setPrivacyNoticeRequired(true);
        setPrivacyNoticeOpen(true);
      } else {
        setPrivacyNoticeRequired(false);
      }
    };

    checkPrivacyNotice();

    return () => {
      cancelled = true;
    };
  }, [auth.user]);

  const closePrivacyNotice = useCallback(async () => {
    if (auth.user) await markPrivacyNoticeSeenInSupabase(auth.user);
    setPrivacyNoticeRequired(false);
    setPrivacyNoticeOpen(false);
  }, [auth.user]);

  const basePlayers = useMemo(() => {
    if (step === 2 && activeMatchTeamId === selectedTeamId && matchRoster.length > 0) {
      return matchRoster;
    }
    if (onlineTeamSeasons.activeTeamSeason) {
      return onlineTeamSeasons.roster
        .filter((player) => player.included && player.active)
        .map((player) => ({
          id: player.player_identity_id,
          nr: Number(player.shirt_number),
          shirtNumber: Number(player.shirt_number),
          name: player.display_name,
          role: player.player_role === "goalkeeper" ? "goalkeeper" : undefined
        }));
    }
    if (selectedTeam && Array.isArray(selectedTeam.players) && selectedTeam.players.length > 0) {
      return selectedTeam.players;
    }
    return [];
  }, [activeMatchTeamId, matchRoster, onlineTeamSeasons.activeTeamSeason, onlineTeamSeasons.roster, selectedTeam, selectedTeamId, step]);

  const allPlayers = useMemo(() => {
    const normalize = (player, index = 0) => {
      const nr = typeof player.nr === "number" ? player.nr : Number(player.nr);
      const shirtNumber =
        typeof player.shirtNumber === "number" ? player.shirtNumber : Number(player.shirtNumber ?? player.nr);
      const name = String(player.name || "").trim();
      return {
        id: player.id || `extra-${slugifyPlayerPart(name)}-${Number.isFinite(shirtNumber) ? shirtNumber : index + 1}`,
        nr,
        shirtNumber,
        name,
        role: player.role === "goalkeeper" ? "goalkeeper" : undefined
      };
    };
    return basePlayers.map((player, index) => normalize(player, index));
  }, [basePlayers]);

  const getPlayerId = useCallback((player) => player?.id ?? player?.nr, []);

  const getPlayerShirtNumber = useCallback((player) => player?.shirtNumber ?? player?.nr, []);

  const playerMatchesRef = useCallback(
    (player, ref) => String(getPlayerId(player)) === String(ref) || String(player?.nr) === String(ref),
    [getPlayerId]
  );

  const findPlayerByRef = useCallback(
    (ref) => allPlayers.find((player) => playerMatchesRef(player, ref)),
    [allPlayers, playerMatchesRef]
  );

  const playersForUI = useMemo(() => sortPlayersForUI(allPlayers), [allPlayers]);

  // Upgrade an already ongoing match saved by an older build with its current roster.
  useEffect(() => {
    if (step !== 2 || !selectedTeamId || allPlayers.length === 0) return;
    if (!activeMatchTeamId) setActiveMatchTeamId(selectedTeamId);
    if (matchRoster.length === 0) setMatchRoster(allPlayers);
  }, [activeMatchTeamId, allPlayers, matchRoster.length, selectedTeamId, step]);
  const pendingMatchesForSelectedTeam = useMemo(
    () =>
      pendingOnlineMatches.filter(
        (match) => match.teamId === selectedTeamId && getMatchSeason(match) === selectedSeason
      ),
    [pendingOnlineMatches, selectedSeason, selectedTeamId]
  );
  const seasonMatchesForView = useMemo(
    () =>
      onlineMatches.online
        ? filterSeasonMatchesByTeam(
            [...onlineMatches.matches, ...pendingMatchesForSelectedTeam],
            selectedTeamId,
            selectedSeason
          )
        : filterSeasonMatchesByTeam(seasonMatches, selectedTeamId, selectedSeason),
    [
      onlineMatches.matches,
      onlineMatches.online,
      pendingMatchesForSelectedTeam,
      seasonMatches,
      selectedSeason,
      selectedTeamId
    ]
  );
  const matchesForPlayerImport = useMemo(
    () =>
      onlineMatches.online
        ? [...onlineMatches.matches, ...pendingOnlineMatches.filter((match) => match.teamId === selectedTeamId)]
        : filterSeasonMatchesByTeam(seasonMatches, selectedTeamId),
    [onlineMatches.matches, onlineMatches.online, pendingOnlineMatches, seasonMatches, selectedTeamId]
  );
  const seasonOptions = useMemo(() => buildSeasonOptions(), []);
  const statsSeasonOptions = useMemo(
    () => Array.from(new Set([
      ...seasonOptions,
      ...matchesForPlayerImport.map(getMatchSeason).filter(Boolean)
    ])).sort((a, b) => getSeasonStartYear(a) - getSeasonStartYear(b)),
    [matchesForPlayerImport, seasonOptions]
  );
  const statsMatchesForView = useMemo(
    () => seasonStatsSelection === "all"
      ? matchesForPlayerImport
      : matchesForPlayerImport.filter((match) => getMatchSeason(match) === seasonStatsSelection),
    [matchesForPlayerImport, seasonStatsSelection]
  );

  useEffect(() => {
    if (!seasonOptions.includes(selectedSeason)) {
      setSelectedSeason(getDefaultSeason());
    }
  }, [seasonOptions, selectedSeason]);

  const seasonSummary = useMemo(
    () => buildSeasonSummary(statsMatchesForView, selectedTeam ? [selectedTeam] : teamsData),
    [statsMatchesForView, selectedTeam]
  );
  const seasonKpis = useMemo(
    () => buildSeasonKpis(statsMatchesForView, seasonSummary.fieldPlayers),
    [statsMatchesForView, seasonSummary.fieldPlayers]
  );

  const cupLabel = useMemo(() => {
    const active = (cupEnabled || cupPanelOpen) && (cupName || "").trim();
    return active ? `${cupName.trim()}${cupPhase ? ` (${cupPhase})` : ""}` : "";
  }, [cupEnabled, cupPanelOpen, cupName, cupPhase]);
  const hasStartedMatchSetup = useMemo(() => {
    const hasMatchInfo =
      Boolean((matchInfo?.date || "").trim()) ||
      Boolean((matchInfo?.opponent || "").trim()) ||
      Boolean((matchInfo?.location || "").trim());
    const hasCupInfo =
      Boolean(cupEnabled) ||
      Boolean((cupName || "").trim()) ||
      Boolean((cupPhase || "").trim());

    return step === 1 && (selectedPlayers.length > 0 || hasMatchInfo || hasCupInfo);
  }, [
    cupEnabled,
    cupName,
    cupPhase,
    matchInfo?.date,
    matchInfo?.location,
    matchInfo?.opponent,
    selectedPlayers.length,
    step
  ]);

  const showToast = useCallback((text) => {
    setToast({ text });
    window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 2000);
  }, []);

  const requestConfirm = useCallback((options) => {
    setConfirmDialog(options);
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmDialog(null);
  }, []);

  useEffect(() => {
    try {
      if (selectedTeamId && selectedTeamId !== EXTERNAL_TEAM_ID) {
        localStorage.setItem(SELECTED_TEAM_KEY, selectedTeamId);
      }
    } catch {}
  }, [selectedTeamId]);

  useEffect(() => {
    try {
      localStorage.setItem(SELECTED_SEASON_KEY, selectedSeason);
    } catch {}
  }, [selectedSeason]);

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
          ? data.players.map((player, index) => {
              const shirtNumber = Number(player.number);
              const name = String(player.name || "").trim();
              return {
                id:
                  player.id ||
                  `${EXTERNAL_TEAM_ID}-${slugifyPlayerPart(name)}-${Number.isFinite(shirtNumber) ? shirtNumber : index + 1}`,
                nr: shirtNumber,
                shirtNumber,
                name,
                role: player.type === "goalkeeper" ? "goalkeeper" : undefined
              };
            })
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

  useEffect(() => {
    savePendingOnlineMatches(pendingOnlineMatches);
  }, [pendingOnlineMatches]);

  useEffect(() => {
    if (!onlineMatches.online || pendingMatchesForSelectedTeam.length === 0) return undefined;

    let cancelled = false;

    const syncPendingMatches = async () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;

      for (const pendingMatch of pendingMatchesForSelectedTeam) {
        if (cancelled) return;

        const { error } = await onlineMatches.saveMatch(pendingMatch);
        if (error) return;

        setPendingOnlineMatches((prev) => prev.filter((match) => match.id !== pendingMatch.id));
      }
    };

    syncPendingMatches();
    window.addEventListener("online", syncPendingMatches);

    return () => {
      cancelled = true;
      window.removeEventListener("online", syncPendingMatches);
    };
  }, [onlineMatches, pendingMatchesForSelectedTeam]);

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
        cupEnabled,
        cupName,
        cupPhase,
        cupPanelOpen,
        activeMatchTeamId,
        matchRoster
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
    cupEnabled,
    cupName,
    cupPhase,
    cupPanelOpen,
    activeMatchTeamId,
    matchRoster
  ]);

  useEffect(() => {
    persist();
  }, [persist]);

  useEffect(() => {
    const persistWhenHidden = () => {
      if (document.visibilityState === "hidden") persist();
    };
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", persistWhenHidden);
    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", persistWhenHidden);
    };
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

  const togglePlayer = useCallback((playerId) => {
    setSelectedPlayers((prev) =>
      prev.includes(playerId)
        ? prev.filter((item) => item !== playerId)
        : [...prev, playerId]
    );
  }, []);

  const playerHasMatchActivity = useCallback(
    (playerRef) => {
      const player = findPlayerByRef(playerRef);
      const matchesRef = (ref) => {
        if (ref === undefined || ref === null || ref === "") return false;
        if (player) return playerMatchesRef(player, ref);
        return String(ref) === String(playerRef);
      };

      const hasHistory = history.some((item) => matchesRef(item?.playerId) || matchesRef(item?.nr));
      if (hasHistory) return true;

      const refs = Array.from(
        new Set(
          [
            playerRef,
            player?.id,
            player?.nr,
            player?.shirtNumber
          ]
            .filter((value) => value !== undefined && value !== null && value !== "")
            .map((value) => String(value))
        )
      );
      const playerStats = refs.map((ref) => stats?.[ref]).find(Boolean);
      if (!playerStats) return false;

      return Object.entries(playerStats).some(([key, value]) => {
        if (key === "byHalf") {
          return Object.values(value || {}).some((halfStats) =>
            Object.values(halfStats || {}).some((count) => Number(count) > 0)
          );
        }

        return Number(value) > 0;
      });
    },
    [findPlayerByRef, history, playerMatchesRef, stats]
  );

  const toggleMatchPlayer = useCallback(
    (playerId) => {
      const player = findPlayerByRef(playerId);
      const isSelected = selectedPlayers.some((ref) =>
        player ? playerMatchesRef(player, ref) : String(ref) === String(playerId)
      );

      if (!isSelected) {
        setSelectedPlayers((prev) => [...prev, playerId]);
        setStats((prev) => ({
          ...prev,
          [playerId]: {
            ...emptyCounters(),
            byHalf: { 1: emptyCounters(), 2: emptyCounters() }
          }
        }));
        showToast(`Lade till #${getPlayerShirtNumber(player) ?? ""} ${player?.name || ""}`);
        return;
      }

      if (playerHasMatchActivity(playerId)) {
        showToast("Spelare med händelser kan inte tas bort från matchen");
        return;
      }

      setSelectedPlayers((prev) =>
        prev.filter((ref) => (player ? !playerMatchesRef(player, ref) : String(ref) !== String(playerId)))
      );
      setStats((prev) => {
        const next = { ...(prev || {}) };
        [playerId, player?.id, player?.nr, player?.shirtNumber]
          .filter((value) => value !== undefined && value !== null && value !== "")
          .forEach((ref) => {
            delete next[ref];
          });
        return next;
      });
      showToast(`Tog bort #${getPlayerShirtNumber(player) ?? ""} ${player?.name || ""}`);
    },
    [
      findPlayerByRef,
      getPlayerShirtNumber,
      playerMatchesRef,
      playerHasMatchActivity,
      selectedPlayers,
      showToast
    ]
  );

  const handleMatchInfoChange = useCallback((event) => {
    const { name, value } = event.target;
    setMatchInfo((prev) => ({ ...prev, [name]: value }));
    if (name === "date" && value) {
      const dateSeason = getSeasonFromDate(value);
      if (dateSeason && dateSeason !== selectedSeason) {
        setSelectedSeason(dateSeason);
        setSelectedPlayers([]);
      }
    }
  }, [selectedSeason]);

  const startMatch = useCallback(() => {
    if (!matchInfo?.date || !matchInfo?.opponent || !matchInfo?.location) {
      alert("Fyll i datum, motståndare och Hemma/Borta innan du startar matchen.");
      return;
    }

    if (selectedPlayers.length === 0) {
      alert("Välj minst en spelare");
      return;
    }

    const beginMatch = () => {
      const initialStats = {};
      selectedPlayers.forEach((nr) => {
        initialStats[nr] = {
          ...emptyCounters(),
          byHalf: { 1: emptyCounters(), 2: emptyCounters() }
        };
      });
      setStats(initialStats);
      setCurrentHalf(1);
      setActiveMatchTeamId(selectedTeamId);
      setMatchRoster(allPlayers);
      setStep(2);
      setViewMode("match");
    };

    const matchSeason = getSeasonFromDate(matchInfo.date);
    if (matchSeason && matchSeason !== getDefaultSeason()) {
      requestConfirm({
        title: "Starta match i tidigare säsong?",
        message: `Matchdatumet gör att matchen sparas i säsong ${matchSeason}.`,
        confirmText: "Starta match",
        cancelText: "Avbryt",
        onConfirm: beginMatch
      });
      return;
    }

    beginMatch();
  }, [allPlayers, matchInfo, requestConfirm, selectedPlayers, selectedTeamId]);

  const increment = useCallback(
    (nr, type) => {
      ensurePlayerStats(nr);

      const player = findPlayerByRef(nr);
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

        return { ...prev, [nr]: next };
      });

      setHistory((prev) => [
        ...prev,
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          time: Date.now(),
          playerId: getPlayerId(player),
          nr: getPlayerShirtNumber(player),
          playerName: player?.name || "",
          playerRole: player?.role || "field",
          type,
          half: currentHalf
        }
      ]);

      showToast(`#${getPlayerShirtNumber(player) ?? nr} ${player?.name || ""} – ${eventLabel(type, player)}`);
    },
    [currentHalf, ensurePlayerStats, findPlayerByRef, getPlayerId, getPlayerShirtNumber, showToast]
  );

  const undoLast = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];

    setStats((prev) => {
      const playerRef = last.playerId ?? last.nr;
      const playerStats = prev[playerRef];
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

      return { ...prev, [playerRef]: next };
    });

    setHistory((prev) => prev.slice(0, -1));
    const player = findPlayerByRef(last.playerId ?? last.nr);
    showToast(
      `Ångrade: #${last.nr ?? getPlayerShirtNumber(player) ?? ""} ${player?.name || ""} – ${eventLabel(last.type, player)}`
    );
  }, [currentHalf, findPlayerByRef, getPlayerShirtNumber, history, showToast]);

  const deleteHistoryItem = useCallback(
    (id) => {
      const item = history.find((entry) => entry.id === id);
      if (!item) return;

      setStats((prev) => {
        const playerRef = item.playerId ?? item.nr;
        const playerStats = prev[playerRef];
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

        return { ...prev, [playerRef]: next };
      });

      setHistory((prev) => prev.filter((entry) => entry.id !== id));
      const player = findPlayerByRef(item.playerId ?? item.nr);
      showToast(
        `Raderade: #${item.nr ?? getPlayerShirtNumber(player) ?? ""} ${player?.name || ""} – ${eventLabel(item.type, player)}`
      );
    },
    [currentHalf, findPlayerByRef, getPlayerShirtNumber, history, showToast]
  );

  const computeFinalScore = useCallback(
    (statsObj) => {
      let ourGoals = 0;
      let oppGoals = 0;

      Object.entries(statsObj || {}).forEach(([nr, playerStats]) => {
        const player = findPlayerByRef(nr);
        if (!player) return;

        if (player.role === "goalkeeper") {
          oppGoals += (playerStats.goal || 0) + (playerStats.sevenGoal || 0);
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
    [findPlayerByRef, matchInfo?.location]
  );

  const saveCurrentMatchToSeason = useCallback(async () => {
    const result = computeFinalScore(stats);
    const matchSeason = getSeasonFromDate(matchInfo.date) || selectedSeason;
    const matchRecord = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      teamId: selectedTeamId,
      teamName: selectedTeam?.name || "",
      season: matchSeason,
      matchInfo: { ...matchInfo, season: matchSeason },
      matchType: cupEnabled || cupPanelOpen ? "cup" : "series",
      cupName: cupEnabled || cupPanelOpen ? (cupName || "").trim() : "",
      cupPhase: cupEnabled || cupPanelOpen ? (cupPhase || "").trim() : "",
      result,
      selectedPlayers: [...selectedPlayers],
      playerRoster: [...selectedPlayers]
        .map((playerRef) => {
          const player = findPlayerByRef(playerRef);
          const playerId = getPlayerId(player) ?? playerRef;
          const shirtNumber = getPlayerShirtNumber(player);
          return {
            id: playerId,
            playerId,
            nr: Number(shirtNumber),
            shirtNumber: Number(shirtNumber),
            name: player?.name || "",
            role: player?.role === "goalkeeper" ? "goalkeeper" : undefined
          };
        })
        .filter((player) => Number.isFinite(Number(player.shirtNumber))),
      stats: JSON.parse(JSON.stringify(stats || {})),
      history: JSON.parse(JSON.stringify(history || []))
    };

    const alreadySaved = seasonMatchesForView.some((match) => {
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
      return;
    }

    if (onlineMatches.online) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setPendingOnlineMatches((prev) => [...prev, { ...matchRecord, pendingSync: true }]);
        showToast("Match sparad offline och synkas när nätet är tillbaka");
        return;
      }

      const { error } = await onlineMatches.saveMatch(matchRecord);
      if (error) {
        setPendingOnlineMatches((prev) => [...prev, { ...matchRecord, pendingSync: true }]);
        showToast("Match sparad offline och synkas senare");
        return;
      }

      showToast("Match sparad online");
      return;
    }

    setSeasonMatches((prev) => {
      showToast("Match sparad i säsongen");
      return [...prev, matchRecord];
    });
  }, [
    cupEnabled,
    cupName,
    cupPanelOpen,
    cupPhase,
    findPlayerByRef,
    getPlayerId,
    getPlayerShirtNumber,
    computeFinalScore,
    history,
    matchInfo,
    onlineMatches,
    selectedPlayers,
    selectedSeason,
    selectedTeam,
    selectedTeamId,
    seasonMatchesForView,
    showToast,
    stats
  ]);

  const resetMatchState = useCallback(() => {
    setStats({});
    setHistory([]);
    setSelectedPlayers([]);
    setActiveMatchTeamId(null);
    setMatchRoster([]);
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
        cupEnabled,
        cupName,
        cupPhase,
        cupPanelOpen,
        activeMatchTeamId: null,
        matchRoster: []
      })
    );

    window.scrollTo(0, 0);
  }, [
    cupEnabled,
    cupName,
    cupPanelOpen,
    cupPhase
  ]);

  const confirmReset = useCallback(() => {
    if (step === 2 && (history.length > 0 || Object.keys(stats || {}).length > 0)) {
      requestConfirm({
        title: "Avsluta match?",
        message: `Spara matchen (${matchInfo?.date || "-"} vs ${matchInfo?.opponent || "-"}) i säsongen innan du startar ny match?`,
        confirmText: "Spara och avsluta",
        secondaryText: "Avsluta utan att spara",
        cancelText: "Avbryt",
        variant: "danger",
        onConfirm: async () => {
          await saveCurrentMatchToSeason();
          resetMatchState();
        },
        onSecondary: () => {
          requestConfirm({
            title: "Avsluta utan att spara?",
            message: "Matchen tas bort från pågående läge och sparas inte i säsongen.",
            confirmText: "Ja, avsluta utan att spara",
            cancelText: "Avbryt",
            variant: "danger",
            onConfirm: resetMatchState
          });
        }
      });
      return;
    }

    resetMatchState();
  }, [
    history.length,
    matchInfo,
    requestConfirm,
    resetMatchState,
    saveCurrentMatchToSeason,
    stats,
    step
  ]);

  const exportSeasonJson = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      teamId: selectedTeamId || null,
      teamName: seasonCenterTeam?.name || null,
      season: seasonStatsSelection === "all" ? "Alla säsonger" : seasonStatsSelection,
      matches: statsMatchesForView
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const teamPart =
      (seasonCenterTeam?.name || selectedTeamId || "season")
        .toString()
        .replace(/[^\p{L}\p{N}\-_ ]/gu, "")
        .trim() || "season";
    link.href = url;
    const seasonPart = seasonStatsSelection === "all" ? "alla-sasonger" : seasonStatsSelection.replace("/", "-");
    link.download = `matchapp_season_${teamPart}_${seasonPart}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Säsong (JSON) nedladdad");
  }, [seasonCenterTeam, seasonStatsSelection, selectedTeamId, showToast, statsMatchesForView]);

  const downloadExcel = useCallback(async (savedMatch = null) => {
    if (savedMatch) {
      const roster = Array.isArray(savedMatch.playerRoster)
        ? savedMatch.playerRoster.map((player) => ({
            ...player,
            nr: player.nr ?? player.shirtNumber,
            shirtNumber: player.shirtNumber ?? player.nr,
            id: player.playerId ?? player.id,
            playerId: player.playerId ?? player.id
          }))
        : [];

      await exportMatchExcel({
        matchInfo: savedMatch.matchInfo || {},
        cupEnabled: savedMatch.matchType === "cup",
        cupPanelOpen: savedMatch.matchType === "cup",
        cupName: savedMatch.cupName || "",
        cupPhase: savedMatch.cupPhase || "",
        allPlayers: roster,
        selectedPlayers: roster.map((player) => player.playerId ?? player.id ?? player.nr),
        stats: savedMatch.stats || {},
        history: savedMatch.history || []
      });
      return;
    }

    await exportMatchExcel({
      matchInfo,
      cupEnabled,
      cupPanelOpen,
      cupName,
      cupPhase,
      allPlayers,
      selectedPlayers,
      stats,
      history
    });
  }, [allPlayers, cupEnabled, cupName, cupPanelOpen, cupPhase, history, matchInfo, selectedPlayers, stats]);

  const handleDeleteSeasonMatch = useCallback(
    async (matchId) => {
      if (!canDeleteFromSelectedTeam) {
        showToast("Endast ägare kan ta bort matcher");
        return;
      }

    if (onlineMatches.online) {
      const pendingMatch = pendingOnlineMatches.find((match) => match.id === matchId);
      if (pendingMatch) {
        setPendingOnlineMatches((prev) => prev.filter((match) => match.id !== matchId));
        showToast("Match borttagen");
        return;
      }

      const { error } = await onlineMatches.deleteMatch(matchId);
        if (error) {
          showToast(`Kunde inte ta bort online: ${error.message}`);
          return;
        }

        showToast("Match borttagen");
        return;
      }

      setSeasonMatches((prev) => prev.filter((match) => match.id !== matchId));
      showToast("Match borttagen");
    },
    [canDeleteFromSelectedTeam, onlineMatches, pendingOnlineMatches, showToast]
  );

  const handleClearSeason = useCallback(async (targetSeason, targetMatches) => {
    if (!targetSeason || targetSeason === "all") {
      showToast("Välj en enskild säsong att rensa");
      return;
    }
    if (!canDeleteFromSelectedTeam) {
      showToast("Endast ägare kan rensa säsongen");
      return;
    }

    if (targetMatches.length === 0) {
      showToast("Säsongen är redan tom");
      return;
    }

    if (onlineMatches.online) {
      setPendingOnlineMatches((prev) =>
        prev.filter((match) => !(match.teamId === selectedTeamId && getMatchSeason(match) === targetSeason))
      );

      for (const match of targetMatches) {
        if (match.pendingSync) continue;
        const { error } = await onlineMatches.deleteMatch(match.id);
        if (error) {
          showToast(`Kunde inte rensa online: ${error.message}`);
          return;
        }
      }

      showToast("Säsongen rensad");
      setSeasonOpen(false);
      return;
    }

    setSeasonMatches((prev) =>
      prev.filter(
        (match) => !((selectedTeamId ? match.teamId === selectedTeamId : true) && getMatchSeason(match) === targetSeason)
      )
    );

    showToast("Säsongen rensad");
    setSeasonOpen(false);
  }, [
    canDeleteFromSelectedTeam,
    onlineMatches,
    selectedTeamId,
    showToast
  ]);

  const getSeasonMatchKey = useCallback((match) => {
    const result = match?.result || {};
    return [
      match?.teamId || selectedTeamId || "",
      getMatchSeason(match) || "",
      match?.matchInfo?.date || "",
      match?.matchInfo?.opponent || "",
      match?.matchInfo?.location || "",
      result.home ?? "",
      result.away ?? ""
    ].join("|");
  }, [selectedTeamId]);

  const handleImportSeasonBackup = useCallback(
    async (data) => {
      if (data?.invalid || !Array.isArray(data?.matches)) {
        showToast("Kunde inte läsa backupfilen");
        return;
      }

      if (!selectedTeamId || !selectedTeam) {
        showToast("Välj lag innan import");
        return;
      }

      const importedMatches = data.matches
        .filter((match) => !data.teamId || match.teamId === data.teamId)
        .map((match) => {
          const season = normalizeSeason(match.season || match.matchInfo?.season || getMatchSeason(match) || selectedSeason);
          return {
            ...match,
            id: match.id || `${Date.now()}_${Math.random().toString(36).slice(2)}`,
            createdAt: match.createdAt || new Date().toISOString(),
            teamId: selectedTeamId,
            teamName: selectedTeam.name || match.teamName || "",
            matchInfo: { ...(match.matchInfo || {}), season },
            season,
            matchType: match.matchType || "series",
            cupName: match.cupName || "",
            cupPhase: match.cupPhase || "",
            result: match.result || {},
            selectedPlayers: match.selectedPlayers || [],
            playerRoster: match.playerRoster || [],
            stats: match.stats || {},
            history: match.history || []
          };
        });

      if (importedMatches.length === 0) {
        showToast("Backupen innehåller inga matcher för valt lag");
        return;
      }

      const existingMatchesForTeam = onlineMatches.online
        ? [
            ...onlineMatches.matches,
            ...pendingOnlineMatches.filter((match) => match.teamId === selectedTeamId)
          ]
        : filterSeasonMatchesByTeam(seasonMatches, selectedTeamId);
      const existingKeys = new Set(existingMatchesForTeam.map(getSeasonMatchKey));
      const matchesToImport = [];
      let skipped = 0;

      importedMatches.forEach((match) => {
        const key = getSeasonMatchKey(match);
        if (existingKeys.has(key)) {
          skipped += 1;
          return;
        }
        existingKeys.add(key);
        matchesToImport.push(match);
      });

      if (matchesToImport.length === 0) {
        showToast(`Inga nya matcher att importera (${skipped} fanns redan)`);
        return;
      }

      if (onlineMatches.online) {
        let imported = 0;

        for (const match of matchesToImport) {
          const { error } = await onlineMatches.saveMatch(match);
          if (error) {
            showToast(`Import avbruten: ${error.message}`);
            return;
          }
          imported += 1;
        }

        showToast(`Importerade ${imported} matcher online${skipped ? `, hoppade över ${skipped}` : ""}`);
        return;
      }

      setSeasonMatches((prev) => [...prev, ...matchesToImport]);
      showToast(`Importerade ${matchesToImport.length} matcher${skipped ? `, hoppade över ${skipped}` : ""}`);
    },
    [
      getSeasonMatchKey,
      onlineMatches,
      pendingOnlineMatches,
      seasonMatches,
      selectedTeam,
      selectedTeamId,
      selectedSeason,
      showToast
    ]
  );

  const handleSignOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const performTeamSelection = useCallback((teamId) => {
    setExternalTeamData(null);
    setSelectedTeamId(teamId);
    setSelectedPlayers([]);
    setStats({});
    setHistory([]);
    setActiveMatchTeamId(null);
    setMatchRoster([]);
    setMatchInfo({ date: "", opponent: "", location: "" });
    setCurrentHalf(1);
    setViewMode("match");
    setStep(1);
  }, []);

  const handleSelectTeam = useCallback((teamId) => {
    if (!teamId || teamId === selectedTeamId) return;

    const hasOngoingMatch = step === 2 && selectedPlayers.length > 0;
    if (!hasOngoingMatch) {
      if (hasStartedMatchSetup) {
        requestConfirm({
          title: "Byta lag?",
          message: "Du har börjat sätta upp en match. Uppställning och matchinfo försvinner om du byter lag nu.",
          confirmText: "Byt lag",
          cancelText: "Avbryt",
          variant: "danger",
          onConfirm: () => {
            performTeamSelection(teamId);
          }
        });
        return;
      }

      performTeamSelection(teamId);
      return;
    }

    requestConfirm({
      title: "Byta lag?",
      message: `Matchen (${matchInfo?.date || "-"} vs ${matchInfo?.opponent || "-"}) är igång. Vill du spara den i säsongen innan du byter lag?`,
      confirmText: "Spara och byt",
      secondaryText: "Byt utan att spara",
      cancelText: "Avbryt",
      variant: "danger",
      onConfirm: async () => {
        await saveCurrentMatchToSeason();
        performTeamSelection(teamId);
      },
      onSecondary: () => {
        performTeamSelection(teamId);
      }
    });
  }, [
    matchInfo?.date,
    matchInfo?.opponent,
    hasStartedMatchSetup,
    performTeamSelection,
    requestConfirm,
    saveCurrentMatchToSeason,
    selectedPlayers.length,
    selectedTeamId,
    step
  ]);

  const handleTeamCreated = useCallback(
    (createdTeam) => {
      if (!createdTeam) return;

      const nextTeam = {
        id: createdTeam.slug || createdTeam.id,
        onlineId: createdTeam.id,
        name: createdTeam.name,
        membershipRole: "owner",
        deletionScheduledAt: null,
        players: []
      };

      onlineTeams.setTeams((prev) => [...prev, nextTeam]);
      accountAccess.refresh();
      performTeamSelection(nextTeam.id);
      setTeamAdminOpen(true);
      showToast("Lag skapat");
    },
    [accountAccess, onlineTeams, performTeamSelection, showToast]
  );

  const handleTeamPlayersChanged = useCallback(
    (players) => {
      if (!selectedTeam?.id) return;

      const mappedPlayers = (players || [])
        .filter((player) => player.active !== false)
        .map((player) => ({
          id: player.id,
          nr: Number(player.shirt_number),
          shirtNumber: Number(player.shirt_number),
          name: player.name,
          role: player.role === "goalkeeper" ? "goalkeeper" : undefined
        }));

      onlineTeams.setTeams((prev) =>
        prev.map((team) =>
          team.id === selectedTeam.id
            ? { ...team, players: mappedPlayers }
            : team
        )
      );
    },
    [onlineTeams, selectedTeam]
  );

  const handleTeamDeletionChanged = useCallback(
    (changedTeam, deletionScheduledAt) => {
      if (!changedTeam?.id) return;

      onlineTeams.setTeams((prev) =>
        prev.map((team) =>
          team.id === changedTeam.id ? { ...team, deletionScheduledAt } : team
        )
      );
      showToast(deletionScheduledAt ? "Laget raderas om 24 timmar" : "Raderingen är ångrad");
    },
    [onlineTeams, showToast]
  );

  const handleTeamMembershipChanged = useCallback(
    (changedTeam, membershipRole) => {
      if (!changedTeam?.id) return;

      if (!membershipRole) {
        onlineTeams.setTeams((prev) => prev.filter((team) => team.id !== changedTeam.id));
        setTeamAdminOpen(false);
        performTeamSelection(null);
      } else {
        onlineTeams.setTeams((prev) =>
          prev.map((team) =>
            team.id === changedTeam.id ? { ...team, membershipRole } : team
          )
        );
      }

      accountAccess.refresh();
    },
    [accountAccess, onlineTeams, performTeamSelection]
  );

  const canStartMatch =
    Boolean(matchInfo?.date) && Boolean(matchInfo?.opponent) && Boolean(matchInfo?.location);

  const liveScore = useMemo(() => {
    let our = 0;
    let opp = 0;

    Object.entries(stats).forEach(([nr, playerStats]) => {
      const player = findPlayerByRef(nr);
      if (!player) return;

      if (player.role === "goalkeeper") {
        opp += (playerStats.goal || 0) + (playerStats.sevenGoal || 0);
        our += playerStats.gkScored || 0;
      } else {
        our += (playerStats.goal || 0) + (playerStats.sevenGoal || 0);
      }
    });

    return { our, opp };
  }, [findPlayerByRef, stats]);

  const isHome = (matchInfo?.location || "") === "Hemma";
  const topbarLiveHome = isHome ? liveScore.our : liveScore.opp;
  const topbarLiveAway = isHome ? liveScore.opp : liveScore.our;
  const onlineStatus = !isOnline
    ? "Offline – sparas på telefonen"
    : onlineMatches.online
    ? pendingMatchesForSelectedTeam.length > 0
      ? `${pendingMatchesForSelectedTeam.length} match${pendingMatchesForSelectedTeam.length === 1 ? "" : "er"} väntar på synk`
      : onlineTeams.usingCache
        ? "Offline: cachelagrat lag"
        : onlineMatches.loading
        ? "Synkar..."
        : offlineReady
          ? "Synkad online · Offline redo"
          : "Synkad online · Förbereder offline"
    : "Lokal lagring";
  const pendingAccountCount = Number(accountAccess.pendingAccountCount || 0);
  const renderSystemAdminLabel = () => (
    <span className="inline-flex items-center justify-center gap-1.5">
      <span>Systemadmin</span>
      {pendingAccountCount > 0 && (
        <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-white">
          {pendingAccountCount > 99 ? "99+" : pendingAccountCount}
        </span>
      )}
    </span>
  );
  const updatePrompt = (
    <AppUpdatePrompt
      visible={appUpdate.updateAvailable}
      onReload={appUpdate.reloadToUpdate}
      reloading={appUpdate.reloading}
    />
  );

  if (startupIntroVisible) {
    return <StartupSplash />;
  }

  if (externalTeamLoading) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <h2 className="text-xl font-semibold mb-4">Laddar lag...</h2>
        {updatePrompt}
      </div>
    );
  }

  if (isSupabaseConfigured && auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-sm">
          Laddar inloggning...
        </div>
        {updatePrompt}
      </div>
    );
  }

  if (isSupabaseConfigured && !auth.user) {
    return (
      <>
        <AuthView appVersion={APP_VERSION} />
        {updatePrompt}
      </>
    );
  }

  if (isSupabaseConfigured && (onlineTeams.loading || accountAccess.loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-sm">
          Hämtar din åtkomst...
        </div>
        <PrivacyNoticeModal
          open={privacyNoticeOpen}
          requireAcknowledge={privacyNoticeRequired}
          onClose={closePrivacyNotice}
        />
        {updatePrompt}
      </div>
    );
  }

  if (isSupabaseConfigured && auth.user && accountAccess.accountStatus === "blocked") {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">MatchApp</p>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Kontot är blockerat</h1>
            <p className="mt-2 text-sm text-slate-600">
              Kontakta ansvarig om du tror att detta är fel.
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Logga ut
            </button>
          </div>
        </div>
        {updatePrompt}
      </>
    );
  }

  if (isSupabaseConfigured && auth.user && accountAccess.error) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">MatchApp</p>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Problem med sessionen</h1>
            <p className="mt-2 text-sm text-slate-600">
              Din behörighet kunde inte kontrolleras just nu. Försök igen eller logga in på nytt.
            </p>
            <p className="mt-3 text-sm font-medium text-red-700">{accountAccess.error}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={accountAccess.refresh}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Försök igen
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Logga ut
              </button>
            </div>
          </div>
        </div>
        {updatePrompt}
      </>
    );
  }

  if (isSupabaseConfigured && auth.user && accountAccess.accountStatus === "pending") {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">MatchApp</p>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Kontot väntar på godkännande</h1>
            <p className="mt-2 text-sm text-slate-600">
              En administratör behöver godkänna kontot innan du kan använda appen.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={accountAccess.refresh}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Kontrollera igen
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Logga ut
              </button>
            </div>
          </div>
        </div>
        {updatePrompt}
      </>
    );
  }

  if (activeMatchTeamUnavailable) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
          <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">MatchApp</p>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Den sparade matchens lag saknas</h1>
            <p className="mt-2 text-sm text-slate-600">
              Chrome har en lokalt sparad pågående match för ett lag som ditt konto inte längre har åtkomst till.
            </p>
            <p className="mt-3 text-sm font-semibold text-slate-700">
              Inget tas bort automatiskt. Om du fortsätter rensas bara den lokalt sparade pågående matchen.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => performTeamSelection(availableTeams[0]?.id || null)}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Rensa matchen och fortsätt
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Logga ut
              </button>
            </div>
          </div>
        </div>
        {updatePrompt}
      </>
    );
  }

  if ((!selectedTeamId || !selectedTeam) && availableTeams.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-sm">
          Väljer lag...
        </div>
        <PrivacyNoticeModal
          open={privacyNoticeOpen}
          requireAcknowledge={privacyNoticeRequired}
          onClose={closePrivacyNotice}
        />
        {updatePrompt}
      </div>
    );
  }

  if (!selectedTeamId) {
    return (
      <>
        <TeamPicker
          teams={availableTeams}
          appVersion={APP_VERSION}
          onSelectTeam={handleSelectTeam}
          error={onlineTeams.error}
          onTeamCreated={isSupabaseConfigured && auth.user ? handleTeamCreated : null}
          accountAccess={accountAccess}
          pendingAccountCount={pendingAccountCount}
          onOpenSystemAdmin={accountAccess.isSystemAdmin ? () => setSystemAdminOpen(true) : null}
          onSignOut={isSupabaseConfigured && auth.user ? handleSignOut : null}
        />
        <SystemAdminPanel
          open={systemAdminOpen}
          currentUser={auth.user}
          onClose={() => setSystemAdminOpen(false)}
          onToast={showToast}
          onChanged={accountAccess.refresh}
        />
        <PrivacyNoticeModal
          open={privacyNoticeOpen}
          requireAcknowledge={privacyNoticeRequired}
          onClose={closePrivacyNotice}
        />
        {updatePrompt}
      </>
    );
  }

  return (
    <div className="p-4 max-w-7xl mx-auto relative">
      {isSupabaseConfigured && auth.user && !(step === 2 && selectedPlayers.length > 0) && (
        <div className="mb-3 flex justify-end">
          <div className="w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-sm sm:w-auto">
            <div className="mb-1 flex min-w-0 items-center justify-end gap-2 text-xs text-slate-500">
              <span className="min-w-0 truncate">{auth.user.email}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  !isOnline
                    ? "bg-red-100 text-red-800"
                    : pendingMatchesForSelectedTeam.length > 0
                    ? "bg-amber-100 text-amber-800"
                    : onlineTeams.usingCache
                      ? "bg-amber-100 text-amber-800"
                    : onlineMatches.online
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-700"
                }`}
              >
                {onlineStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setSeasonStatsSelection(getDefaultSeason());
                  setSeasonOpen(true);
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Matcher & statistik
              </button>
              {selectedTeam?.onlineId && (
                <button
                  type="button"
                  onClick={() => setTeamAdminOpen(true)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Lag
                </button>
              )}
              {accountAccess.isSystemAdmin && (
                <button
                  type="button"
                  onClick={() => setSystemAdminOpen(true)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {renderSystemAdminLabel()}
                </button>
              )}
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hjälp
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              >
                Logga ut
              </button>
            </div>
          </div>
        </div>
      )}

      {(step === 1 || (step === 2 && selectedPlayers.length === 0)) && (
        <MatchSetup
          teamName={selectedTeam?.name}
          matchInfo={matchInfo}
          onMatchInfoChange={handleMatchInfoChange}
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
          onStartMatch={startMatch}
          canStartMatch={canStartMatch && !onlineTeamSeasons.loading}
          appVersion={APP_VERSION}
          changelogTooltip={CHANGELOG_TOOLTIP}
          matchSeason={matchInfo.date ? getSeasonFromDate(matchInfo.date) : selectedSeason}
          isPastSeason={Boolean(matchInfo.date && getSeasonFromDate(matchInfo.date) !== getDefaultSeason())}
          playersLoading={onlineTeamSeasons.loading}
        />
      )}

      {step === 2 && selectedPlayers.length > 0 && (
        <MatchSession
          currentHalf={currentHalf}
          setCurrentHalf={setCurrentHalf}
          viewMode={viewMode}
          setViewMode={setViewMode}
          undoLast={undoLast}
          onReset={confirmReset}
          matchInfo={matchInfo}
          selectedTeam={selectedTeam}
          liveHome={topbarLiveHome}
          liveAway={topbarLiveAway}
          cupLabel={cupLabel}
          history={history}
          allPlayers={allPlayers}
          onDeleteHistoryItem={deleteHistoryItem}
          selectedPlayers={selectedPlayers}
          stats={stats}
          increment={increment}
          playersForUI={playersForUI}
          isOnline={isOnline}
          onToggleMatchPlayer={toggleMatchPlayer}
          onConfirm={requestConfirm}
        />
      )}

      <SeasonCenter
        open={seasonOpen}
        selectedTeam={seasonCenterTeam}
        teams={availableTeams}
        selectedTeamId={selectedTeamId}
        onSelectTeam={handleSelectTeam}
        selectedSeason={seasonStatsSelection}
        seasonOptions={["all", ...statsSeasonOptions]}
        onSeasonChange={setSeasonStatsSelection}
        seasonKpis={seasonKpis}
        onExportBackup={exportSeasonJson}
        onImportBackup={handleImportSeasonBackup}
        onClose={() => setSeasonOpen(false)}
        seasonSummary={seasonSummary}
        matches={statsMatchesForView}
        onDeleteMatch={handleDeleteSeasonMatch}
        onClearSeason={() => handleClearSeason(seasonStatsSelection, statsMatchesForView)}
        onExportMatchExcel={downloadExcel}
        onConfirm={requestConfirm}
        canManageSeason={canDeleteFromSelectedTeam && seasonStatsSelection !== "all"}
      />

      <TeamAdminPanel
        open={teamAdminOpen}
        team={selectedTeam}
        teams={availableTeams.map((item) => item.id === selectedTeam?.id ? selectedTeam : item)}
        selectedTeamId={selectedTeamId}
        onSelectTeam={handleSelectTeam}
        accountAccess={accountAccess}
        onTeamCreated={isSupabaseConfigured && auth.user ? handleTeamCreated : null}
        onTeamDeletionChanged={handleTeamDeletionChanged}
        onTeamMembershipChanged={handleTeamMembershipChanged}
        currentUser={auth.user}
        onClose={() => setTeamAdminOpen(false)}
        onToast={showToast}
        onPlayersChanged={handleTeamPlayersChanged}
        onConfirm={requestConfirm}
        matches={matchesForPlayerImport}
        currentUserRole={selectedTeam?.membershipRole}
        selectedSeason={selectedSeason}
        onSeasonChange={setSelectedSeason}
        teamSeasons={onlineTeamSeasons.seasons}
        activeTeamSeason={onlineTeamSeasons.activeTeamSeason}
        seasonRoster={onlineTeamSeasons.roster}
        seasonLoading={onlineTeamSeasons.loading}
        seasonError={onlineTeamSeasons.error}
        onSeasonRefresh={onlineTeamSeasons.refresh}
        onOpenPrivacyNotice={() => {
          setPrivacyNoticeRequired(false);
          setPrivacyNoticeOpen(true);
        }}
      />

      <SystemAdminPanel
        open={systemAdminOpen}
        currentUser={auth.user}
        onClose={() => setSystemAdminOpen(false)}
        onToast={showToast}
        onChanged={accountAccess.refresh}
      />

      <ConfirmDialog
        open={Boolean(confirmDialog)}
        {...(confirmDialog || {})}
        onConfirm={() => {
          const onConfirm = confirmDialog?.onConfirm;
          closeConfirm();
          onConfirm?.();
        }}
        onSecondary={() => {
          const onSecondary = confirmDialog?.onSecondary;
          closeConfirm();
          onSecondary?.();
        }}
        onCancel={() => {
          const onCancel = confirmDialog?.onCancel;
          closeConfirm();
          onCancel?.();
        }}
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

      <PrivacyNoticeModal
        open={privacyNoticeOpen}
        requireAcknowledge={privacyNoticeRequired}
        onClose={closePrivacyNotice}
      />

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      {updatePrompt}
    </div>
  );
}
