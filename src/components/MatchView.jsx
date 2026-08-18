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
  const [mobilePlayerRef, setMobilePlayerRef] = useState(null);

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

  const mobilePlayer = playersForMatch.find(
    (player) => String(getPlayerRef(player)) === String(mobilePlayerRef)
  );
  const mobileStats = mobilePlayer
    ? stats[getPlayerRef(mobilePlayer)] || stats[mobilePlayer.nr] || {}
    : {};
  const mobileIsGk = mobilePlayer?.role === "goalkeeper";
  const mobileConceded = (mobileStats.goal ?? 0) + (mobileStats.sevenGoal ?? 0);
  const mobileSaves = (mobileStats.save ?? 0) + (mobileStats.sevenMiss ?? 0);
  const mobileMoreOpen = Boolean(
    mobilePlayer && String(menuFor) === String(getPlayerRef(mobilePlayer))
  );

  const mobileIncrement = (type) => {
    if (!mobilePlayer) return;
    increment(getPlayerRef(mobilePlayer), type);
    setMobilePlayerRef(null);
    setMenuFor(null);
  };

  return (
    <>
      {menuFor && (
        <button
          type="button"
          className="match-tablet-only fixed inset-0 z-30 cursor-default bg-transparent"
          onClick={() => setMenuFor(null)}
          aria-label="Stäng Mer"
        />
      )}

      <div className="match-phone-only match-phone-shell">
        <div>
          <div className="match-phone-player-grid grid grid-cols-2 gap-2 pb-3">
            {playersForMatch.map((player) => {
              const playerRef = getPlayerRef(player);
              const playerStats = stats[playerRef] || stats[player.nr] || {};
              const isGk = player.role === "goalkeeper";
              const isSelected = String(playerRef) === String(mobilePlayerRef);
              const primaryTotal = isGk
                ? (playerStats.save ?? 0) + (playerStats.sevenMiss ?? 0)
                : (playerStats.goal ?? 0) + (playerStats.sevenGoal ?? 0);

              return (
                <button
                  type="button"
                  key={playerRef}
                  onClick={() => setMobilePlayerRef(playerRef)}
                  className={`min-h-[58px] rounded-2xl border px-3 py-2 text-left transition ${
                    isSelected
                      ? "border-slate-900 bg-slate-900 text-white shadow-md ring-2 ring-slate-200"
                    : isGk
                        ? "border-amber-300 bg-amber-100 text-slate-900 shadow-sm"
                        : "border-sky-300 bg-sky-100 text-slate-900 shadow-sm"
                  }`}
                  aria-pressed={isSelected}
                >
                  <div className="flex min-w-0 flex-col items-center justify-center leading-tight text-center">
                    <span className="min-w-0 max-w-full truncate text-base font-semibold">{player.name}</span>
                    <span className={`mt-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-white/70 text-slate-700"
                    }`}>
                      {isGk ? `R ${primaryTotal}` : `M ${primaryTotal}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {mobilePlayer && (
          <div className="match-phone-action-panel sticky bottom-0 z-20 -mx-4 border-t border-slate-300 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_rgba(15,23,42,0.14)] backdrop-blur">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {mobileMoreOpen ? "Mer" : "Vald spelare"}
                </div>
                <div className="truncate text-base font-extrabold text-slate-900">
                  #{getPlayerShirtNumber(mobilePlayer)} {mobilePlayer.name}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  mobileIsGk ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300" : "bg-sky-100 text-sky-900 ring-1 ring-sky-300"
                }`}>
                  {mobileIsGk ? "Målvakt" : "Utespelare"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMobilePlayerRef(null);
                    setMenuFor(null);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xl font-bold leading-none text-slate-600"
                  aria-label="Stäng vald spelare"
                  title="Stäng"
                >
                  ×
                </button>
              </div>
            </div>

            {mobileMoreOpen ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`min-h-[50px] rounded-xl border px-3 text-sm font-bold shadow-sm ${mobileIsGk ? "border-rose-300 bg-rose-100 text-rose-900" : "border-emerald-300 bg-emerald-100 text-emerald-900"}`}
                  onClick={() => mobileIncrement("sevenGoal")}
                >
                  {mobileIsGk ? "7m insläppt" : "7m mål"}
                </button>
                <button
                  type="button"
                  className={`min-h-[50px] rounded-xl border px-3 text-sm font-bold shadow-sm ${mobileIsGk ? "border-emerald-300 bg-emerald-100 text-emerald-900" : "border-rose-300 bg-rose-100 text-rose-900"}`}
                  onClick={() => mobileIncrement("sevenMiss")}
                >
                  {mobileIsGk ? "7m räddning" : "7m miss"}
                </button>
                <button
                  type="button"
                  className="min-h-[50px] rounded-xl border border-orange-200 bg-orange-50 px-3 text-sm font-bold text-orange-800 shadow-sm"
                  onClick={() => mobileIncrement("twoMin")}
                >
                  2 min
                </button>
                <button
                  type="button"
                  className="min-h-[50px] rounded-xl border border-yellow-200 bg-yellow-50 px-3 text-sm font-bold text-yellow-800 shadow-sm"
                  onClick={() => mobileIncrement("yellowCard")}
                >
                  Gult kort
                </button>
                <button
                  type="button"
                  className="min-h-[50px] rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-bold text-red-800 shadow-sm"
                  onClick={() => mobileIncrement("redCard")}
                >
                  Rött kort
                </button>
                {mobileIsGk && (
                  <button
                    type="button"
                    className="min-h-[50px] rounded-xl border border-sky-200 bg-sky-50 px-3 text-sm font-bold text-sky-800 shadow-sm"
                    onClick={() => mobileIncrement("gkScored")}
                  >
                    Målvaktsmål
                  </button>
                )}
                {!mobileIsGk && (
                  <button
                    type="button"
                    className="min-h-[50px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 shadow-sm"
                    onClick={() => mobileIncrement("turnover")}
                  >
                    Tekn. fel
                  </button>
                )}
                <button
                  type="button"
                  className="col-start-2 min-h-[50px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm"
                  onClick={() => setMenuFor(null)}
                >
                  Tillbaka
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <PopButton
                  className={`min-h-[52px] rounded-xl border px-2 text-sm font-semibold shadow-md ring-2 ring-white ${mobileIsGk ? "border-rose-400 bg-rose-200 text-rose-950" : "border-emerald-400 bg-emerald-200 text-emerald-950"}`}
                  onClick={() => mobileIncrement("goal")}
                >
                  {mobileIsGk ? `Insläppt (${mobileConceded})` : `Mål (${(mobileStats.goal ?? 0) + (mobileStats.sevenGoal ?? 0)})`}
                </PopButton>
                <PopButton
                  className={`min-h-[52px] rounded-xl border px-2 text-sm font-semibold shadow-md ring-2 ring-white ${mobileIsGk ? "border-emerald-400 bg-emerald-200 text-emerald-950" : "border-rose-400 bg-rose-200 text-rose-950"}`}
                  onClick={() => mobileIncrement("save")}
                >
                  {mobileIsGk ? `Räddn. (${mobileSaves})` : `Räddning (${mobileStats.save ?? 0})`}
                </PopButton>
                <PopButton
                  className="min-h-[52px] rounded-xl border border-amber-400 bg-amber-200 px-2 text-sm font-semibold text-amber-950 shadow-md ring-2 ring-white"
                  onClick={() => mobileIncrement("post")}
                >
                  Ribba ({mobileStats.post ?? 0})
                </PopButton>
                <PopButton
                  className="min-h-[48px] rounded-xl border border-slate-400 bg-slate-200 px-2 text-sm font-semibold text-slate-900 shadow-md ring-2 ring-white"
                  onClick={() => mobileIncrement("miss")}
                >
                  Utanför ({mobileStats.miss ?? 0})
                </PopButton>
                {!mobileIsGk && (
                  <PopButton
                    className="min-h-[48px] rounded-xl border border-sky-400 bg-sky-200 px-2 text-sm font-semibold text-sky-950 shadow-md ring-2 ring-white"
                    onClick={() => mobileIncrement("assist")}
                  >
                    Assist ({mobileStats.assist ?? 0})
                  </PopButton>
                )}
                {mobileIsGk && (
                  <PopButton
                    className="min-h-[48px] rounded-xl border border-sky-400 bg-sky-200 px-2 text-sm font-semibold text-sky-950 shadow-md ring-2 ring-white"
                    onClick={() => mobileIncrement("assist")}
                  >
                    Assist ({mobileStats.assist ?? 0})
                  </PopButton>
                )}
                <button
                  type="button"
                  className="min-h-[48px] rounded-xl border border-slate-400 bg-white px-2 text-sm font-semibold text-slate-900 shadow-md ring-2 ring-white"
                  onClick={() => setMenuFor(getPlayerRef(mobilePlayer))}
                >
                  Mer
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="match-tablet-grid grid-cols-2 items-start gap-3 md:grid-cols-3 lg:grid-cols-4">
        {playersForMatch.map((p, index) => {
          const playerRef = getPlayerRef(p);
          const shirtNumber = getPlayerShirtNumber(p);
          const s = stats[playerRef] || stats[p.nr] || {};
          const isGk = p.role === "goalkeeper";
          const gkConcededTotal = (s.goal ?? 0) + (s.sevenGoal ?? 0);
          const gkSavesTotal = (s.save ?? 0) + (s.sevenMiss ?? 0);
          const sevenGoalLabel = isGk ? "7m insl" : "7m mål";
          const sevenMissLabel = isGk ? "7m rädd" : "7m miss";

          const btnBase = "w-full rounded-xl border px-2 py-2 text-xs font-semibold leading-tight shadow-md ring-2 ring-white transition hover:-translate-y-px hover:shadow-lg lg:text-sm";
          const btnStyle = {
            alignItems: "center",
            display: "flex",
            justifyContent: "center",
            minHeight: "36px",
            whiteSpace: "nowrap"
          };
          const goalBtnClass = isGk ? "border-rose-400 bg-rose-200 text-rose-950" : "border-emerald-400 bg-emerald-200 text-emerald-950";
          const saveBtnClass = isGk ? "border-emerald-400 bg-emerald-200 text-emerald-950" : "border-rose-400 bg-rose-200 text-rose-950";
          const missBtnClass = "border-slate-400 bg-slate-200 text-slate-900";
          const postBtnClass = "border-amber-400 bg-amber-200 text-amber-950";
          const assistBtnClass = "border-sky-400 bg-sky-200 text-sky-950";
          const moreBtnClass = "border-slate-300 bg-white text-slate-800";
          const menuPositionClass = [
            index % 2 === 1 ? "right-0" : "left-0",
            index % 3 === 2 ? "md:right-0 md:left-auto" : "md:left-0 md:right-auto",
            index % 4 === 3 ? "lg:right-0 lg:left-auto" : "lg:left-0 lg:right-auto"
          ].join(" ");

          return (
            <div
              key={playerRef}
              className={`relative rounded-2xl border p-3 shadow-sm ${isGk ? "border-amber-300 bg-amber-100/80" : "border-sky-300 bg-sky-100/90"}`}
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
                      className={`rounded-xl border px-3 py-3 text-sm font-bold shadow-sm ${
                        isGk ? "border-rose-300 bg-rose-100 text-rose-900" : "border-emerald-300 bg-emerald-100 text-emerald-900"
                      }`}
                      onClick={() => {
                        increment(playerRef, "sevenGoal");
                        setMenuFor(null);
                      }}
                    >
                      {sevenGoalLabel}
                    </button>
                    <button
                      className={`rounded-xl border px-3 py-3 text-sm font-bold shadow-sm ${
                        isGk ? "border-emerald-300 bg-emerald-100 text-emerald-900" : "border-rose-300 bg-rose-100 text-rose-900"
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
                      className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-3 text-sm font-bold text-orange-800 hover:bg-orange-100"
                      onClick={() => { increment(playerRef, "twoMin"); setMenuFor(null); }}
                    >
                      2 min
                    </button>
                    <button
                      className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-3 text-sm font-bold text-yellow-800 hover:bg-yellow-100"
                      onClick={() => { increment(playerRef, "yellowCard"); setMenuFor(null); }}
                    >
                      Gult
                    </button>
                    <button
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-bold text-red-800 hover:bg-red-100"
                      onClick={() => { increment(playerRef, "redCard"); setMenuFor(null); }}
                    >
                      Rött
                    </button>
                    <button
                      className={`rounded-xl border px-3 py-3 text-sm font-bold ${
                        isGk
                          ? "border-sky-300 bg-sky-100 text-sky-900 hover:bg-sky-200"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                      onClick={() => {
                        increment(playerRef, isGk ? "gkScored" : "turnover");
                        setMenuFor(null);
                      }}
                    >
                      {isGk ? "MV mål" : "Tekn. fel"}
                    </button>
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
