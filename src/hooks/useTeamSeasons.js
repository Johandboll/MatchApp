import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export function useTeamSeasons(user, team, selectedSeason) {
  const [seasons, setSeasons] = useState([]);
  const [activeTeamSeason, setActiveTeamSeason] = useState(null);
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedTeamId, setLoadedTeamId] = useState(null);
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
      return;
    }

    setLoading(true);
    setError("");

    const { data: seasonRows, error: seasonError } = await supabase.rpc("list_team_seasons", {
      target_team_id: team.onlineId
    });

    if (requestId !== requestIdRef.current) return;

    if (seasonError) {
      setSeasons([]);
      setActiveTeamSeason(null);
      setRoster([]);
      setError(seasonError.message);
      setLoading(false);
      return;
    }

    const nextSeasons = seasonRows || [];
    const seasonToSelect = seasonOverride || selectedSeason;
    const selected = nextSeasons.find((item) => item.season_name === seasonToSelect) || null;
    setSeasons(nextSeasons);
    setActiveTeamSeason(selected);
    setLoadedTeamId(team.onlineId);

    if (!selected) {
      setRoster([]);
      setLoading(false);
      return;
    }

    const { data: rosterRows, error: rosterError } = await supabase.rpc("list_team_season_roster", {
      target_team_id: team.onlineId,
      target_team_season_id: selected.team_season_id
    });

    if (requestId !== requestIdRef.current) return;

    if (rosterError) {
      setRoster([]);
      setError(rosterError.message);
    } else {
      setRoster(rosterRows || []);
    }
    setLoading(false);
  }, [selectedSeason, team?.onlineId, user?.id]);

  useEffect(() => {
    refresh();
    return () => {
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
    refresh
  };
}
