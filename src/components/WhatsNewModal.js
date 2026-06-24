import React, { useEffect, useRef } from "react";

export default function WhatsNewModal({ open, title, items, previousVersion, previousItems, onClose }) {
  const modalRef = useRef(null);
  const cleanItems = (Array.isArray(items) ? items : [])
    .map((x) => (x == null ? "" : String(x)))
    .map((s) => s.trim())
    .filter(Boolean);
  const cleanPreviousItems = (Array.isArray(previousItems) ? previousItems : [])
    .map((x) => (x == null ? "" : String(x)))
    .map((s) => s.trim())
    .filter(Boolean);

  // ESC-stängning
  useEffect(() => {
    if (!open) return;

    const handleKey = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const scrollY = window.scrollY;
    const previous = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width
    };

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.body.style.overflow = previous.overflow;
      document.body.style.position = previous.position;
      document.body.style.top = previous.top;
      document.body.style.width = previous.width;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        // Klick utanför modalen stänger
        if (modalRef.current && !modalRef.current.contains(e.target)) {
          onClose?.();
        }
      }}
    >
      <div ref={modalRef} style={styles.modal}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.h2}>{title}</h2>
            {cleanItems.length > 3 && <div style={styles.scrollHint}>Scrolla för att läsa allt</div>}
          </div>

          {/* X-knapp */}
          <button
            type="button"
            onClick={onClose}
            style={styles.closeButton}
            aria-label="Stäng"
          >
            ×
          </button>
        </div>

        <div style={styles.body}>
          {cleanItems.length > 0 ? (
            <ul style={styles.ul}>
              {cleanItems.map((txt, idx) => (
                <li key={idx} style={styles.li}>
                  {renderHighlightedPrefix(txt)}
                </li>
              ))}
            </ul>
          ) : (
            <p style={styles.p}>Inga nyheter för den här versionen.</p>
          )}

          {cleanPreviousItems.length > 0 && (
            <section style={styles.previousSection}>
              <h3 style={styles.previousHeading}>Även nytt i {previousVersion}</h3>
              <ul style={styles.previousList}>
                {cleanPreviousItems.map((txt, idx) => (
                  <li key={idx} style={styles.previousItem}>
                    {renderHighlightedPrefix(txt)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div style={styles.bodyFooter}>
            <button type="button" onClick={onClose} style={styles.button}>
              Stäng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderHighlightedPrefix(text) {
  const value = String(text || "").trim();
  const match = value.match(/^\*\*([^*]+):\*\*\s*(.+)$/);
  if (!match) return value;

  return (
    <>
      <strong>{match[1]}:</strong> {match[2]}
    </>
  );
}

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 16,
    overscrollBehavior: "contain",
  },
  modal: {
    width: "min(560px, 100%)",
    maxHeight: "min(760px, calc(100vh - 32px))",
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: "16px 18px",
    borderBottom: "1px solid #eee",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  h2: {
    margin: 0,
    fontSize: 18,
    lineHeight: 1.2,
  },
  scrollHint: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
  },
  closeButton: {
    background: "transparent",
    border: "none",
    fontSize: 22,
    cursor: "pointer",
    lineHeight: 1,
  },
  body: {
    padding: "14px 18px",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    overscrollBehavior: "contain",
  },
  ul: {
    margin: 0,
    paddingLeft: 18,
  },
  li: {
    marginBottom: 8,
  },
  p: {
    margin: 0,
  },
  previousSection: {
    marginTop: 18,
    paddingTop: 14,
    borderTop: "1px solid #e2e8f0",
    color: "#64748b",
  },
  previousHeading: {
    margin: "0 0 8px",
    fontSize: 13,
    color: "#475569",
  },
  previousList: {
    margin: 0,
    paddingLeft: 17,
  },
  previousItem: {
    marginBottom: 6,
    fontSize: 12,
    lineHeight: 1.45,
  },
  bodyFooter: {
    marginTop: 18,
    paddingTop: 14,
    borderTop: "1px solid #eee",
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },
  button: {
    cursor: "pointer",
    border: "1px solid #ccc",
    background: "#f7f7f7",
    padding: "8px 12px",
    borderRadius: 10,
    fontSize: 14,
  },
};
