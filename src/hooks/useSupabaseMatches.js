import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const mapMatchFromDb = (row, team) => ({
  id: row.id,
  createdAt: row.created_at,
  teamId: team?.id || row.team_id,
  onlineTeamId: row.team_id,
  teamName: team?.name || "",
  matchInfo: row.match_info || {},
  season: row.match_info?.season || "",
  matchType: row.match_type || "series",
  cupName: row.cup_name || "",
  cupPhase: row.cup_phase || "",
  result: row.result || {},
  selectedPlayers: row.selected_players || [],
  playerRoster: row.player_roster || [],
  stats: row.stats || {},
  history: row.history || []
});

export function useSupabaseMatches(user, selectedTeam) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canUseOnline = Boolean(supabase && user && selectedTeam?.onlineId);

  const loadMatches = useCallback(async () => {
    if (!canUseOnline) {
      setMatches([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("matches")
      .select("*")
      .eq("team_id", selectedTeam.onlineId)
      .order("created_at", { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setMatches([]);
      setLoading(false);
      return;
    }

    setMatches((data || []).map((row) => mapMatchFromDb(row, selectedTeam)));
    setLoading(false);
  }, [canUseOnline, selectedTeam]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const saveMatch = useCallback(
    async (matchRecord) => {
      if (!canUseOnline) return { data: null, error: null };

      const { data, error: saveError } = await supabase
        .from("matches")
        .insert({
          team_id: selectedTeam.onlineId,
          created_by: user.id,
          match_info: { ...(matchRecord.matchInfo || {}), season: matchRecord.season || matchRecord.matchInfo?.season || "" },
          match_type: matchRecord.matchType,
          cup_name: matchRecord.cupName,
          cup_phase: matchRecord.cupPhase,
          result: matchRecord.result,
          selected_players: matchRecord.selectedPlayers,
          player_roster: matchRecord.playerRoster,
          stats: matchRecord.stats,
          history: matchRecord.history
        })
        .select("*")
        .single();

      if (saveError) return { data: null, error: saveError };

      const mapped = mapMatchFromDb(data, selectedTeam);
      setMatches((prev) => [...prev, mapped]);
      return { data: mapped, error: null };
    },
    [canUseOnline, selectedTeam, user]
  );

  const deleteMatch = useCallback(
    async (matchId) => {
      if (!canUseOnline) return { error: null };

      const { error: deleteError } = await supabase
        .from("matches")
        .delete()
        .eq("id", matchId)
        .eq("team_id", selectedTeam.onlineId);

      if (deleteError) return { error: deleteError };

      setMatches((prev) => prev.filter((match) => match.id !== matchId));
      return { error: null };
    },
    [canUseOnline, selectedTeam]
  );

  const clearMatches = useCallback(async () => {
    if (!canUseOnline) return { error: null };

    const { error: deleteError } = await supabase
      .from("matches")
      .delete()
      .eq("team_id", selectedTeam.onlineId);

    if (deleteError) return { error: deleteError };

    setMatches([]);
    return { error: null };
  }, [canUseOnline, selectedTeam]);

  return {
    matches,
    loading,
    error,
    online: canUseOnline,
    saveMatch,
    deleteMatch,
    clearMatches,
    refresh: loadMatches
  };
}
