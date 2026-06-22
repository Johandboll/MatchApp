import React, { useState, useEffect } from "react";

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

  const getPlayerId = (player) => player?.id ?? player?.nr;
  const getPlayerShirtNumber = (player) => player?.shirtNumber ?? player?.nr;
  const getPlayerRef = (player) => getPlayerId(player);
  const playerMatchesRef = (player, ref) =>
    String(getPlayerId(player)) === String(ref) || String(player?.nr) === String(ref);

  const playersForMatch = allPlayers
    .filter((p) => selectedPlayers.some((ref) => playerMatchesRef(p, ref)))
    .sort((a, b) => {
      const aIsGk = a.role === "goalkeeper" ? -1 : 1;
      const bIsGk = b.role === "goalkeeper" ? -1 : 1;
      return aIsGk - bIsGk || a.nr - b.nr;
    });

  return (
    <>
      {menuFor && (
        <button
          type="button"
          className="fixed inset-0 z-30 cursor-default bg-transparent"
          onClick={() => setMenuFor(null)}
          aria-label="Stäng Mer"
        />
      )}

      <div className="grid grid-cols-2 items-start gap-3 md:grid-cols-3 lg:grid-cols-4">
        {playersForMatch.map((p, index) => {
          const playerRef = getPlayerRef(p);
          const shirtNumber = getPlayerShirtNumber(p);
          const s = stats[playerRef] || stats[p.nr] || {};
          const isGk = p.role === "goalkeeper";
          const gkConcededTotal = (s.goal ?? 0) + (s.sevenGoal ?? 0);
          const gkSavesTotal = (s.save ?? 0) + (s.sevenMiss ?? 0);
          const sevenGoalLabel = isGk ? "7m insl" : "7m mål";
          const sevenMissLabel = isGk ? "7m rädd" : "7m miss";

          const btnBase = "w-full rounded-xl px-2 py-2 text-xs font-semibold leading-tight shadow-sm lg:text-sm";
          const btnStyle = {
            alignItems: "center",
            display: "flex",
            justifyContent: "center",
            minHeight: "36px",
            whiteSpace: "nowrap"
          };
          const goalBtnClass = isGk ? "bg-rose-600 text-white" : "bg-emerald-600 text-white";
          const saveBtnClass = isGk ? "bg-emerald-600 text-white" : "bg-rose-600 text-white";
          const missBtnClass = "bg-sky-600 text-white";
          const postBtnClass = "bg-amber-500 text-slate-950";
          const assistBtnClass = "bg-indigo-600 text-white";
          const moreBtnClass = "bg-slate-800 text-white";
          const menuPositionClass = [
            index % 2 === 1 ? "right-0" : "left-0",
            index % 3 === 2 ? "md:right-0 md:left-auto" : "md:left-0 md:right-auto",
            index % 4 === 3 ? "lg:right-0 lg:left-auto" : "lg:left-0 lg:right-auto"
          ].join(" ");

          return (
            <div
              key={playerRef}
              className={`border p-3 rounded-2xl relative ${isGk ? "bg-yellow-200" : "bg-blue-100"}`}
            >
              <div className="font-semibold mb-2 text-center">#{shirtNumber} {p.name}</div>

              <div className="grid grid-cols-2 gap-2">
                <PopButton className={`${btnBase} ${goalBtnClass}`} style={btnStyle} onClick={() => increment(playerRef, "goal")}>
                  {isGk ? `Insläppt (${gkConcededTotal})` : `Mål (${(s.goal ?? 0) + (s.sevenGoal ?? 0)})`}
                </PopButton>

                <PopButton className={`${btnBase} ${saveBtnClass}`} style={btnStyle} onClick={() => increment(playerRef, "save")}>
                  {isGk ? `Räddn. (${gkSavesTotal})` : `Räddn. (${s.save ?? 0})`}
                </PopButton>

                <PopButton
                  className={`${btnBase} ${postBtnClass}`}
                  style={btnStyle}
                  onClick={() => increment(playerRef, "post")}
                >
                  Ribba ({s.post ?? 0})
                </PopButton>

                <PopButton className={`${btnBase} ${missBtnClass}`} style={btnStyle} onClick={() => increment(playerRef, "miss")}>
                  Utanför ({isGk ? (s.miss ?? 0) : ((s.miss ?? 0) + (s.sevenMiss ?? 0))})
                </PopButton>

                <PopButton className={`${btnBase} ${assistBtnClass}`} style={btnStyle} onClick={() => increment(playerRef, "assist")}>
                  Assist ({s.assist ?? 0})
                </PopButton>

                <PopButton
                  className={`${btnBase} ${moreBtnClass}`}
                  style={btnStyle}
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
                  className={`absolute top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl ${menuPositionClass}`}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Mer</div>
                      <div className="text-base font-extrabold text-slate-900">#{shirtNumber} {p.name}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMenuFor(null)}
                      className="rounded-full px-3 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      aria-label="Stäng"
                      title="Stäng"
                    >
                      ×
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className={`rounded-xl px-3 py-3 text-sm font-bold shadow-sm ${
                        isGk ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
                      }`}
                      onClick={() => {
                        increment(playerRef, "sevenGoal");
                        setMenuFor(null);
                      }}
                    >
                      {sevenGoalLabel}
                    </button>
                    <button
                      className={`rounded-xl px-3 py-3 text-sm font-bold shadow-sm ${
                        isGk ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                      }`}
                      onClick={() => {
                        increment(playerRef, "sevenMiss");
                        setMenuFor(null);
                      }}
                    >
                      {sevenMissLabel}
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      className="rounded-xl bg-amber-100 px-3 py-3 text-sm font-bold text-amber-900 hover:bg-amber-200"
                      onClick={() => { increment(playerRef, "twoMin"); setMenuFor(null); }}
                    >
                      2 min
                    </button>
                    <button
                      className="rounded-xl bg-yellow-100 px-3 py-3 text-sm font-bold text-yellow-900 hover:bg-yellow-200"
                      onClick={() => { increment(playerRef, "yellowCard"); setMenuFor(null); }}
                    >
                      Gult
                    </button>
                    <button
                      className="rounded-xl bg-red-100 px-3 py-3 text-sm font-bold text-red-800 hover:bg-red-200"
                      onClick={() => { increment(playerRef, "redCard"); setMenuFor(null); }}
                    >
                      Rött
                    </button>
                    <button
                      className="rounded-xl bg-slate-100 px-3 py-3 text-sm font-bold text-slate-800 hover:bg-slate-200"
                      onClick={() => { increment(playerRef, "turnover"); setMenuFor(null); }}
                    >
                      Tekn. fel
                    </button>
                    {isGk && (
                      <button
                        className="col-span-2 rounded-xl bg-slate-800 px-3 py-3 text-sm font-bold text-white hover:bg-slate-900"
                        onClick={() => { increment(playerRef, "gkScored"); setMenuFor(null); }}
                      >
                        MV mål
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
