import { useEffect } from "react";

let lockCount = 0;
let savedScrollY = 0;
let savedBodyStyle = null;
let savedHtmlOverflow = "";

export function useDocumentScrollLock(locked) {
  useEffect(() => {
    if (!locked || typeof document === "undefined") return undefined;

    if (lockCount === 0) {
      savedScrollY = window.scrollY || 0;
      savedBodyStyle = {
        position: document.body.style.position,
        top: document.body.style.top,
        width: document.body.style.width,
        overflow: document.body.style.overflow
      };
      savedHtmlOverflow = document.documentElement.style.overflow;

      document.documentElement.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
    }

    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount !== 0 || !savedBodyStyle) return;

      document.documentElement.style.overflow = savedHtmlOverflow;
      document.body.style.position = savedBodyStyle.position;
      document.body.style.top = savedBodyStyle.top;
      document.body.style.width = savedBodyStyle.width;
      document.body.style.overflow = savedBodyStyle.overflow;
      if (savedScrollY > 0) window.scrollTo(0, savedScrollY);
      savedBodyStyle = null;
    };
  }, [locked]);
}
