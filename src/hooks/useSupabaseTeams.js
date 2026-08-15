import { useEffect, useState } from "react";
import teamsData from "../data/teams.json";
import { supabase } from "../lib/supabaseClient";

const TEAMS_CACHE_KEY = "matchapp-supabase-teams-cache";

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
    membershipRole,
    deletionScheduledAt: team.deletion_scheduled_at || null,
    players: onlinePlayers.length > 0 ? onlinePlayers : localTeam?.players || []
  };
};

export function useSupabaseTeams(user) {
  const userId = user?.id || null;
  const [teams, setTeams] = useState(() => (user?.id ? readTeamsCache(user.id) : []));
  const [loading, setLoading] = useState(Boolean(supabase && user));
  const [error, setError] = useState("");
  const [usingCache, setUsingCache] = useState(false);

  useEffect(() => {
    if (!supabase || !userId) {
      setTeams([]);
      setLoading(false);
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
        return;
      }

      const nextTeams = (data || [])
        .filter((row) => row.teams)
        .map((row) => mergeWithLocalRoster(row.teams, row.role));

      setTeams(nextTeams);
      writeTeamsCache(userId, nextTeams);
      setUsingCache(false);
      setLoading(false);
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

  return { teams, loading, error, usingCache, setTeams: setTeamsAndCache };
}
