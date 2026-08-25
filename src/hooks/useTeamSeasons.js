import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export function useTeamSeasons(user, team, selectedSeason) {
  const [seasons, setSeasons] = useState([]);
  const [activeTeamSeason, setActiveTeamSeason] = useState(null);
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async (seasonOverride) => {
    if (!supabase || !user?.id || !team?.onlineId) {
      setSeasons([]);
      setActiveTeamSeason(null);
      setRoster([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    const { data: seasonRows, error: seasonError } = await supabase.rpc("list_team_seasons", {
      target_team_id: team.onlineId
    });

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

    if (!selected) {
      setRoster([]);
      setLoading(false);
      return;
    }

    const { data: rosterRows, error: rosterError } = await supabase.rpc("list_team_season_roster", {
      target_team_id: team.onlineId,
      target_team_season_id: selected.team_season_id
    });

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
  }, [refresh]);

  return { seasons, activeTeamSeason, roster, loading, error, refresh };
}
