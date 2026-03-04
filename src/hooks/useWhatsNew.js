import { useEffect, useMemo, useState } from "react";
import { getWhatsNewItems } from "../changelog";

const STORAGE_KEY = "matchapp_whatsnew_seen_version";

function getAppVersion() {
  // CRA: REACT_APP_VERSION finns vid build om du sätter den så
  return process.env.REACT_APP_VERSION || "0.0.0";
}

export function useWhatsNew() {
  const version = useMemo(() => getAppVersion(), []);
  const items = useMemo(() => getWhatsNewItems(version), [version]);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seenVersion = localStorage.getItem(STORAGE_KEY);
      if (seenVersion !== version) {
        setOpen(true);
      }
    } catch {
      // localStorage kan vara blockerat i vissa lägen
      setOpen(false);
    }
  }, [version]);

  function close() {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, version);
    } catch {
      // ignore
    }
  }

  return { open, version, items, close };
}
