import { useCallback, useEffect, useState } from "react";
import { APP_VERSION, BUILD_TIME } from "../config/appVersion";

const getVersionUrl = () => {
  const baseUrl = process.env.PUBLIC_URL || "";
  return `${baseUrl}/version.json?ts=${Date.now()}`;
};

const isNewerBuild = (remote) => {
  if (!remote) return false;
  if (remote.version && remote.version !== APP_VERSION) return true;
  if (remote.buildTime && remote.buildTime !== BUILD_TIME) return true;
  return false;
};

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState(null);
  const [remoteVersion, setRemoteVersion] = useState(null);
  const [reloading, setReloading] = useState(false);

  const checkVersion = useCallback(async () => {
    if (process.env.NODE_ENV !== "production") return;

    try {
      const response = await fetch(getVersionUrl(), {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache"
        }
      });
      if (!response.ok) return;

      const remote = await response.json();
      if (isNewerBuild(remote)) {
        setRemoteVersion(remote);
        setUpdateAvailable(true);
      }
    } catch {
      // Offline or poor coverage should not disturb match mode.
    }
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return undefined;

    const handleUpdateAvailable = (event) => {
      setRegistration(event.detail?.registration || null);
      setUpdateAvailable(true);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") checkVersion();
    };

    window.addEventListener("matchapp:update-available", handleUpdateAvailable);
    checkVersion();

    const interval = window.setInterval(checkVersion, 5 * 60 * 1000);
    window.addEventListener("focus", checkVersion);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("matchapp:update-available", handleUpdateAvailable);
      window.clearInterval(interval);
      window.removeEventListener("focus", checkVersion);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkVersion]);

  const reloadToUpdate = useCallback(async () => {
    setReloading(true);

    try {
      const activeRegistration =
        registration ||
        (navigator.serviceWorker?.getRegistration
          ? await navigator.serviceWorker.getRegistration()
          : null);

      if (activeRegistration) {
        await activeRegistration.update();
        if (activeRegistration.waiting) {
          activeRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
          return;
        }
      }
    } catch {
      // Fall through to a normal reload.
    }

    window.location.reload();
  }, [registration]);

  return {
    updateAvailable,
    remoteVersion,
    reloading,
    reloadToUpdate
  };
}
