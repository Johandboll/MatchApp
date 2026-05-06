import React, { useState, useEffect, useRef } from "react";

/** Liten wrapper som lägger på en kort "pop"-animation när man klickar */
function PopButton({ className = "", onClick, children, ...rest }) {
  const [pop, setPop] = useState(false);

  const handleClick = (e) => {
    setPop(true);
    window.setTimeout(() => setPop(false), 180);
    onClick && onClick(e);
  };

  return (
    <button
      {...rest}
      onClick={handleClick}
      className={`${className} ${pop ? "pop" : ""}`}
    >
      {children}
    </button>
  );
}

export default function MatchView({ allPlayers, selectedPlayers, stats, increment }) {
  const [menuFor, setMenuFor] = useState(null);
  const containerRef = useRef(null);

  // 🔥 Stäng "Mer"-menyn vid ESC
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
        setMenuFor(null);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  // 🔥 Stäng vid klick utanför
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setMenuFor(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getPlayerId = (player) => player?.id ?? player?.nr;
  const getPlayerShirtNumber = (player) => player?.shirtNumber ?? player?.nr;
  const getPlayerRef = (player) => getPlayerId(player);
  const playerMatchesRef = (player, ref) =>
    String(getPlayerId(player)) === String(ref) || String(player?.nr) === String(ref);

  const sevenLabelA = (playerRef) => {
    const p = allPlayers.find((x) => playerMatchesRef(x, playerRef));
    if (!p) return ["Mål", "Miss"];
    return p.role === "goalkeeper" ? ["Insläppt", "Räddning"] : ["Mål", "Miss"];
  };

  return (
    <div ref={containerRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {allPlayers
        .filter((p) => selectedPlayers.some((ref) => playerMatchesRef(p, ref)))
        .sort((a, b) => {
          const aIsGk = a.role === "goalkeeper" ? -1 : 1;
          const bIsGk = b.role === "goalkeeper" ? -1 : 1;
          return aIsGk - bIsGk || a.nr - b.nr;
        })
        .map((p) => {
          const playerRef = getPlayerRef(p);
          const shirtNumber = getPlayerShirtNumber(p);
          const s = stats[playerRef] || stats[p.nr] || {};
          const isGk = p.role === "goalkeeper";

          const btnBase = "px-3 py-2 rounded-xl text-sm font-semibold shadow w-full";
          const goalBtnClass = isGk ? "bg-red-600 text-white" : "bg-green-600 text-white";
          const saveBtnClass = isGk ? "bg-green-600 text-white" : "bg-red-600 text-white";
          const missBtnClass = "bg-blue-600 text-white";
          const postBtnClass = "bg-yellow-500 text-black";
          const assistBtnClass = "bg-purple-600 text-white";
          const moreBtnClass = "bg-gray-800 text-white";

          return (
            <div
              key={playerRef}
              className={`border p-3 rounded-2xl relative ${isGk ? "bg-yellow-200" : "bg-blue-100"}`}
            >
              <div className="font-semibold mb-2 text-center">#{shirtNumber} {p.name}</div>

              <div className="grid grid-cols-2 gap-2">
                <PopButton className={`${btnBase} ${goalBtnClass}`} onClick={() => increment(playerRef, "goal")}>
                  {isGk ? `Insläppt (${s.goal ?? 0})` : `Mål (${(s.goal ?? 0) + (s.sevenGoal ?? 0)})`}
                </PopButton>

                <PopButton className={`${btnBase} ${saveBtnClass}`} onClick={() => increment(playerRef, "save")}>
                  Räddn. ({s.save ?? 0})
                </PopButton>

                <PopButton
                  className={`${btnBase} ${assistBtnClass}`}
                  onClick={() => increment(playerRef, "assist")}
                >
                  Assist ({s.assist ?? 0})
                </PopButton>

                <PopButton className={`${btnBase} ${missBtnClass}`} onClick={() => increment(playerRef, "miss")}>
                  Utanför ({isGk ? (s.miss ?? 0) : ((s.miss ?? 0) + (s.sevenMiss ?? 0))})
                </PopButton>

                <PopButton className={`${btnBase} ${postBtnClass}`} onClick={() => increment(playerRef, "post")}>
                  Ribba ({s.post ?? 0})
                </PopButton>

                <PopButton
                  className={`${btnBase} ${moreBtnClass}`}
                  onClick={() => setMenuFor(menuFor === playerRef ? null : playerRef)}
                  aria-expanded={menuFor === playerRef}
                  aria-haspopup="menu"
                >
                  Mer ▾
                </PopButton>
              </div>

              {menuFor === playerRef && (
                <div
                  role="menu"
                  className="absolute z-20 right-3 top-[3.5rem] w-56 bg-white rounded-xl shadow-lg border p-2"
                >
                                    <div className="flex items-center justify-between px-2 pb-1">
                    <div className="text-xs font-semibold text-gray-500">Mer</div>
                    <button
                      type="button"
                      onClick={() => setMenuFor(null)}
                      className="text-gray-500 hover:text-gray-800 text-lg leading-none"
                      aria-label="Stäng"
                      title="Stäng"
                    >
                      ×
                    </button>
                  </div>

                  <div className="text-xs font-semibold text-gray-500 px-2 pb-1">7 m</div>
                  <div className="grid grid-cols-2 gap-2 px-2 pb-2">
                    <button
                      className="px-2 py-1 rounded bg-gray-800 text-white text-xs"
                      onClick={() => {
                        increment(playerRef, "sevenGoal");
                        setMenuFor(null);
                      }}
                    >
                      {sevenLabelA(playerRef)[0]}
                    </button>
                    <button
                      className="px-2 py-1 rounded bg-gray-200 text-gray-900 text-xs"
                      onClick={() => {
                        increment(playerRef, "sevenMiss");
                        setMenuFor(null);
                      }}
                    >
                      {sevenLabelA(playerRef)[1]}
                    </button>
                  </div>

                  <button
                    className="w-full text-left px-3 py-1.5 rounded hover:bg-gray-100 text-sm"
                    onClick={() => { increment(playerRef, "twoMin"); setMenuFor(null); }}
                  >
                    Utvisning (2 min)
                  </button>

                  <button
                    className="w-full text-left px-3 py-1.5 rounded hover:bg-gray-100 text-sm"
                    onClick={() => { increment(playerRef, "yellowCard"); setMenuFor(null); }}
                  >
                    Gult kort
                  </button>

                  <button
                    className="w-full text-left px-3 py-1.5 rounded hover:bg-gray-100 text-sm"
                    onClick={() => { increment(playerRef, "redCard"); setMenuFor(null); }}
                  >
                    Rött kort
                  </button>

                  {isGk && (
                    <button
                      className="w-full text-left px-3 py-1.5 rounded hover:bg-gray-100 text-sm"
                      onClick={() => { increment(playerRef, "gkScored"); setMenuFor(null); }}
                    >
                      MV mål
                    </button>
                  )}

                  <button
                    className="w-full text-left px-3 py-1.5 rounded hover:bg-gray-100 text-sm"
                    onClick={() => { increment(playerRef, "turnover"); setMenuFor(null); }}
                  >
                    Tekniskt fel
                  </button>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
