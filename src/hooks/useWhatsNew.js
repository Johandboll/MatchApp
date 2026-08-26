import { useEffect, useMemo, useState } from "react";
import { getWhatsNewItems } from "../changelog";
import { APP_VERSION } from "../config/appVersion";
import { storageKey } from "../lib/storageKeys";

const STORAGE_KEY = storageKey("whatsnew-seen-version");

export function useWhatsNew() {
  const version = useMemo(() => APP_VERSION, []);
  const items = useMemo(() => getWhatsNewItems(version), [version]);
  const previousVersion = "2.0.2";
  const previousItems = useMemo(() => getWhatsNewItems("2.0.2"), []);

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

  return { open, version, items, previousVersion, previousItems, close };
}
