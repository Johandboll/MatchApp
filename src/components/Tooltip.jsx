// src/components/Tooltip.jsx
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Tooltip that works on hover (desktop) and tap (mobile),
 * and auto-positions/clamps within the viewport.
 */
export default function Tooltip({ content, children, offset = 8 }) {
  const anchorRef = useRef(null);
  const tipRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  // Close on outside click / ESC
  useEffect(() => {
    function onDocClick(e) {
      if (!anchorRef.current) return;
      if (!anchorRef.current.contains(e.target)) setOpen(false);
    }
    function onEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  // Recompute position when opening and on resize/scroll
  useLayoutEffect(() => {
    if (!open) return;

    function place() {
      if (!anchorRef.current || !tipRef.current) return;
      const a = anchorRef.current.getBoundingClientRect();
      const t = tipRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Try above first
      let top = a.top - t.height - offset;
      let left = a.left + a.width / 2 - t.width / 2;

      // Clamp horizontally
      const margin = 8;
      left = Math.max(margin, Math.min(left, vw - t.width - margin));

      // If above doesn't fit, place below
      if (top < margin) {
        top = a.bottom + offset;
        if (top + t.height > vh - margin) {
          // If still doesn't fit, clamp to bottom margin
          top = vh - t.height - margin;
        }
      }

      setCoords({ top, left });
    }

    place();
    const ro = new ResizeObserver(place);
    ro.observe(document.documentElement);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, offset]);

  const tipNode = open && content ? createPortal(
    <div
      ref={tipRef}
      role="tooltip"
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        maxWidth: 360,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        zIndex: 9999
      }}
      className="text-xs bg-black text-white px-2 py-1 rounded shadow-lg"
    >
      {content}
    </div>,
    document.body
  ) : null;

  return (
    <span
      ref={anchorRef}
      className="relative inline-flex items-center cursor-pointer"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((v) => !v);
      }}
      aria-haspopup="true"
      aria-expanded={open ? "true" : "false"}
    >
      {children}
      {tipNode}
    </span>
  );
}
