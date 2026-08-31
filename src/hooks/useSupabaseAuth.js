import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export function useSupabaseAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    const updateAutoRefresh = () => {
      if (navigator.onLine === false) {
        supabase.auth.stopAutoRefresh();
      } else {
        supabase.auth.startAutoRefresh();
      }
    };

    updateAutoRefresh();
    window.addEventListener("online", updateAutoRefresh);
    window.addEventListener("offline", updateAutoRefresh);

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session || null);
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      window.removeEventListener("online", updateAutoRefresh);
      window.removeEventListener("offline", updateAutoRefresh);
      subscription.unsubscribe();
    };
  }, []);

  return {
    user: session?.user || null,
    session,
    loading
  };
}
