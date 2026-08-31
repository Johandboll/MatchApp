import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { storageKey } from "../lib/storageKeys";

const TEAM_SEASONS_CACHE_KEY = storageKey("team-seasons-cache");

const readSeasonCache = (userId, teamId) => {
  try {
    const cache = JSON.parse(localStorage.getItem(TEAM_SEASONS_CACHE_KEY)) || {};
    return cache[`${userId}:${teamId}`] || null;
  } catch {
    return null;
  }
};

const writeSeasonCache = (userId, teamId, value) => {
  try {
    const cache = JSON.parse(localStorage.getItem(TEAM_SEASONS_CACHE_KEY)) || {};
    cache[`${userId}:${teamId}`] = value;
    localStorage.setItem(TEAM_SEASONS_CACHE_KEY, JSON.stringify(cache));
  } catch {}
};

export function useTeamSeasons(user, team, selectedSeason) {
  const [seasons, setSeasons] = useState([]);
  const [activeTeamSeason, setActiveTeamSeason] = useState(null);
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedTeamId, setLoadedTeamId] = useState(null);
  const [usingCache, setUsingCache] = useState(false);
  const loadedTeamIdRef = useRef(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async (seasonOverride) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!supabase || !user?.id || !team?.onlineId) {
      setSeasons([]);
      setActiveTeamSeason(null);
      setRoster([]);
      setLoading(false);
      setError("");
      setLoadedTeamId(null);
      loadedTeamIdRef.current = null;
      setUsingCache(false);
      return;
    }

    const cached = readSeasonCache(user.id, team.onlineId);
    const seasonToSelect = seasonOverride || selectedSeason;
    const restoreCachedSeason = () => {
      if (!cached) return false;
      const cachedSeasons = cached.seasons || [];
      const cachedSelected = cachedSeasons.find((item) => item.season_name === seasonToSelect) || null;
      setSeasons(cachedSeasons);
      setActiveTeamSeason(cachedSelected);
      setRoster(cachedSelected ? cached.rosters?.[cachedSelected.team_season_id] || [] : []);
      setLoadedTeamId(team.onlineId);
      loadedTeamIdRef.current = team.onlineId;
      setLoading(false);
      setError("");
      setUsingCache(true);
      return true;
    };

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      if (!restoreCachedSeason()) {
        setLoading(false);
        setError("Säsong och trupp har inte sparats på telefonen ännu.");
      }
      return;
    }

    setLoading(true);
    setError("");

    const { data: seasonRows, error: seasonError } = await supabase.rpc("list_team_seasons", {
      target_team_id: team.onlineId
    });

    if (requestId !== requestIdRef.current) return;

    if (seasonError) {
      if (!restoreCachedSeason()) {
        setError(seasonError.message);
        setLoading(false);
        setUsingCache(false);
      }
      return;
    }

    const nextSeasons = seasonRows || [];
    const selected = nextSeasons.find((item) => item.season_name === seasonToSelect) || null;
    const isSameTeam = loadedTeamIdRef.current === team.onlineId;
    setSeasons(nextSeasons);
    setActiveTeamSeason(selected);
    setLoadedTeamId(team.onlineId);
    loadedTeamIdRef.current = team.onlineId;
    setUsingCache(false);

    if (!selected) {
      setRoster([]);
      writeSeasonCache(user.id, team.onlineId, { seasons: nextSeasons, rosters: cached?.rosters || {} });
      setLoading(false);
      return;
    }

    const { data: rosterRows, error: rosterError } = await supabase.rpc("list_team_season_roster", {
      target_team_id: team.onlineId,
      target_team_season_id: selected.team_season_id
    });

    if (requestId !== requestIdRef.current) return;

    if (rosterError) {
      const cachedRoster = cached?.rosters?.[selected.team_season_id];
      if (cachedRoster) {
        setRoster(cachedRoster);
        setError("");
        setUsingCache(true);
      } else {
        if (!isSameTeam) setRoster([]);
        setError(rosterError.message);
      }
    } else {
      const nextRoster = rosterRows || [];
      setRoster(nextRoster);
      writeSeasonCache(user.id, team.onlineId, {
        seasons: nextSeasons,
        rosters: { ...(cached?.rosters || {}), [selected.team_season_id]: nextRoster }
      });
      setUsingCache(false);
    }
    setLoading(false);
  }, [selectedSeason, team?.onlineId, user?.id]);

  useEffect(() => {
    refresh();
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      requestIdRef.current += 1;
    };
  }, [refresh]);

  const matchesCurrentTeam = loadedTeamId === team?.onlineId;
  return {
    seasons: matchesCurrentTeam ? seasons : [],
    activeTeamSeason: matchesCurrentTeam ? activeTeamSeason : null,
    roster: matchesCurrentTeam ? roster : [],
    loading,
    error,
    usingCache,
    refresh
  };
}
