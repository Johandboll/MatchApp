import { useEffect, useState } from "react";
import teamsData from "../data/teams.json";
import { supabase } from "../lib/supabaseClient";
import { getCurrentSeasonDefinition } from "../lib/seasonHelpers";
import { storageKey } from "../lib/storageKeys";

const TEAMS_CACHE_KEY = storageKey("supabase-teams-cache");

const readTeamsCache = (userId) => {
  try {
    const cache = JSON.parse(localStorage.getItem(TEAMS_CACHE_KEY)) || {};
    return Array.isArray(cache[userId]) ? cache[userId] : [];
  } catch {
    return [];
  }
};

const writeTeamsCache = (userId, teams) => {
  try {
    const cache = JSON.parse(localStorage.getItem(TEAMS_CACHE_KEY)) || {};
    cache[userId] = teams;
    localStorage.setItem(TEAMS_CACHE_KEY, JSON.stringify(cache));
  } catch {}
};

export const withCurrentSeasonName = (team, seasons, currentSeasonName) => {
  const currentSeason = (seasons || []).find((season) => season.season_name === currentSeasonName);
  const displayName = currentSeason?.display_name?.trim();
  return displayName ? { ...team, name: displayName } : team;
};

const mergeWithLocalRoster = (team, membershipRole) => {
  const localTeam = teamsData.find((item) => item.id === team.slug);
  const onlinePlayers = Array.isArray(team.players)
    ? team.players
        .filter((player) => player.active !== false)
        .map((player) => ({
          id: player.id,
          nr: Number(player.shirt_number),
          shirtNumber: Number(player.shirt_number),
          name: player.name,
          role: player.role === "goalkeeper" ? "goalkeeper" : undefined
        }))
        .sort((a, b) => Number(a.shirtNumber) - Number(b.shirtNumber))
    : [];

  return {
    id: team.slug || team.id,
    onlineId: team.id,
    name: team.name,
    legacyName: team.name,
    membershipRole,
    deletionScheduledAt: team.deletion_scheduled_at || null,
    players: onlinePlayers.length > 0 ? onlinePlayers : localTeam?.players || []
  };
};

export function useSupabaseTeams(user) {
  const userId = user?.id || null;
  const [teams, setTeams] = useState(() => (user?.id ? readTeamsCache(user.id) : []));
  const [loading, setLoading] = useState(Boolean(supabase && user));
  const [resolvedUserId, setResolvedUserId] = useState(null);
  const [error, setError] = useState("");
  const [usingCache, setUsingCache] = useState(false);

  useEffect(() => {
    if (!supabase || !userId) {
      setTeams([]);
      setLoading(false);
      setResolvedUserId(null);
      setError("");
      setUsingCache(false);
      return;
    }

    let active = true;

    const loadTeams = async () => {
      const cachedTeams = readTeamsCache(userId);
      if (cachedTeams.length > 0) {
        setTeams(cachedTeams);
        setUsingCache(true);
      }

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setLoading(false);
        setResolvedUserId(userId);
        setError(cachedTeams.length > 0 ? "" : "Offline och inga lag finns cachelagrade ännu.");
        return;
      }

      setLoading(true);
      setError("");

      const { data, error: queryError } = await supabase
        .from("team_members")
        .select("role, teams(id, name, slug, deletion_scheduled_at, players(id, shirt_number, name, role, active))")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (!active) return;

      if (queryError) {
        if (cachedTeams.length > 0) {
          setTeams(cachedTeams);
          setUsingCache(true);
          setError("");
        } else {
          setError(queryError.message);
          setTeams([]);
          setUsingCache(false);
        }
        setLoading(false);
        setResolvedUserId(userId);
        return;
      }

      const baseTeams = (data || [])
        .filter((row) => row.teams)
        .map((row) => mergeWithLocalRoster(row.teams, row.role));

      const currentSeasonName = getCurrentSeasonDefinition().name;
      const nextTeams = await Promise.all(baseTeams.map(async (team) => {
        const { data: seasons, error: seasonError } = await supabase.rpc("list_team_seasons", {
          target_team_id: team.onlineId
        });
        if (seasonError) return team;
        return withCurrentSeasonName(team, seasons, currentSeasonName);
      }));

      setTeams(nextTeams);
      writeTeamsCache(userId, nextTeams);
      setUsingCache(false);
      setLoading(false);
      setResolvedUserId(userId);
    };

    loadTeams();

    return () => {
      active = false;
    };
  }, [userId]);

  const setTeamsAndCache = (next) => {
    setTeams((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      if (userId) writeTeamsCache(userId, value);
      return value;
    });
  };

  return {
    teams,
    loading,
    ready: !supabase || !userId || resolvedUserId === userId,
    error,
    usingCache,
    setTeams: setTeamsAndCache
  };
}
