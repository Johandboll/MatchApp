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
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false
  );

  const checkVersion = useCallback(async () => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

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
    window.addEventListener("matchapp:update-available", handleUpdateAvailable);
    checkVersion();

    const interval = window.setInterval(checkVersion, 5 * 60 * 1000);

    return () => {
      window.removeEventListener("matchapp:update-available", handleUpdateAvailable);
      window.clearInterval(interval);
    };
  }, [checkVersion]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      checkVersion();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [checkVersion]);

  const reloadToUpdate = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
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
    updateAvailable: updateAvailable && online,
    remoteVersion,
    reloading,
    reloadToUpdate
  };
}
