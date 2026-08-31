import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { storageKey } from "../lib/storageKeys";

const ACCESS_CACHE_KEY = storageKey("account-access-cache");
const TEAMS_CACHE_KEY = storageKey("supabase-teams-cache");

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

const readAccessCache = (userId) => {
  try {
    const cache = JSON.parse(localStorage.getItem(ACCESS_CACHE_KEY)) || {};
    return cache[userId]?.accountStatus === "approved" ? cache[userId] : null;
  } catch {
    return null;
  }
};

const writeAccessCache = (userId, access) => {
  try {
    const cache = JSON.parse(localStorage.getItem(ACCESS_CACHE_KEY)) || {};
    cache[userId] = access;
    localStorage.setItem(ACCESS_CACHE_KEY, JSON.stringify(cache));
  } catch {}
};

const hasCachedTeams = (userId) => {
  try {
    const cache = JSON.parse(localStorage.getItem(TEAMS_CACHE_KEY)) || {};
    return Array.isArray(cache[userId]) && cache[userId].length > 0;
  } catch {
    return false;
  }
};

const readOfflineAccess = (userId) =>
  readAccessCache(userId) || (hasCachedTeams(userId)
    ? { ...DEFAULT_ACCESS, accountStatus: "approved" }
    : null);

const offlineAccess = (cached) => ({
  ...cached,
  // Privileged administration must always be revalidated online.
  pendingAccountCount: 0,
  isSystemAdmin: false,
  canCreateTeam: false
});

const isFutureJwtError = (error) =>
  /jwt issued at future/i.test(error?.message || "");

const isNetworkError = (error) =>
  /failed to fetch|load failed|network error|network request failed/i.test(error?.message || "");

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export function useAccountAccess(user) {
  const userId = user?.id || null;
  const [access, setAccess] = useState(DEFAULT_ACCESS);
  const [loading, setLoading] = useState(Boolean(supabase && user));
  const [error, setError] = useState("");
  const [usingCache, setUsingCache] = useState(false);

  const refresh = useCallback(async () => {
    if (!supabase || !userId) {
      setAccess(DEFAULT_ACCESS);
      setLoading(false);
      setError("");
      setUsingCache(false);
      return;
    }

    const cachedAccess = readOfflineAccess(userId);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      if (cachedAccess) {
        setAccess(offlineAccess(cachedAccess));
        setError("");
        setUsingCache(true);
      } else {
        setAccess(DEFAULT_ACCESS);
        setError("Öppna MatchApp online en gång innan den kan startas offline.");
        setUsingCache(false);
      }
      setLoading(false);
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
      if (cachedAccess && isNetworkError(queryError)) {
        setAccess(offlineAccess(cachedAccess));
        setError("");
        setUsingCache(true);
      } else {
        setAccess(DEFAULT_ACCESS);
        setError(queryError.message);
        setUsingCache(false);
      }
      setLoading(false);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const nextAccess = mapAccess(row);
    setAccess(nextAccess);
    if (nextAccess.accountStatus === "approved") writeAccessCache(userId, nextAccess);
    setUsingCache(false);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
    window.addEventListener("online", refresh);
    return () => window.removeEventListener("online", refresh);
  }, [refresh]);

  return { ...access, loading, error, usingCache, refresh };
}
