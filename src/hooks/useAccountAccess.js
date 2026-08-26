import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const DEFAULT_ACCESS = {
  accountStatus: "pending",
  teamCreateLimit: 0,
  createdTeamCount: 0,
  pendingAccountCount: 0,
  isSystemAdmin: false,
  canCreateTeam: false
};

const mapAccess = (data) => ({
  accountStatus: data?.account_status || "pending",
  teamCreateLimit: Number(data?.team_create_limit || 0),
  createdTeamCount: Number(data?.created_team_count || 0),
  pendingAccountCount: Number(data?.pending_account_count || 0),
  isSystemAdmin: Boolean(data?.is_system_admin),
  canCreateTeam: Boolean(data?.can_create_team)
});

const isFutureJwtError = (error) =>
  /jwt issued at future/i.test(error?.message || "");

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export function useAccountAccess(user) {
  const userId = user?.id || null;
  const [access, setAccess] = useState(DEFAULT_ACCESS);
  const [loading, setLoading] = useState(Boolean(supabase && user));
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!supabase || !userId) {
      setAccess(DEFAULT_ACCESS);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    let result = await supabase.rpc("get_my_account_access");

    // Supabase Auth och API kan under några sekunder ha olika serverklocka.
    // Vänta då tills den nyutfärdade tokenen blivit giltig och försök igen.
    for (let attempt = 0; attempt < 2 && isFutureJwtError(result.error); attempt += 1) {
      await wait(1500);
      result = await supabase.rpc("get_my_account_access");
    }

    const { data, error: queryError } = result;

    if (queryError) {
      setAccess(DEFAULT_ACCESS);
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    setAccess(mapAccess(row));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...access, loading, error, refresh };
}
