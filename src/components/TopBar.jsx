import React from "react";

export default function TopBar({
  currentHalf, setCurrentHalf,
  viewMode, setViewMode,
  undoLast, onReset,
  matchInfo, selectedTeam, liveHome, liveAway,
  cupLabel,
  onOpenLog
}) {
  const ourTeamName = selectedTeam?.name || "Vi";
  const opponentName = matchInfo?.opponent || "Mot";
  const isAway = (matchInfo?.location || "") === "Borta";
  const homeLabel = isAway ? opponentName : ourTeamName;
  const awayLabel = isAway ? ourTeamName : opponentName;

  return (
    <>
      {/* Toppresultat */}
      <div className="mb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm text-gray-700">
            <strong>Match:</strong> {matchInfo?.date || "-"} mot {matchInfo?.opponent || "-"} ({matchInfo?.location || "-"}){cupLabel ? ` • Cup: ${cupLabel}` : ""}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Aktiv halvlek:</span>
            <div className="inline-flex border rounded-xl overflow-hidden">
              <button
                className={`px-3 py-1 ${currentHalf === 1 ? "bg-green-600 text-white" : "bg-white"}`}
                onClick={() => setCurrentHalf(1)}
              >
                1:a
              </button>
              <button
                className={`px-3 py-1 ${currentHalf === 2 ? "bg-green-600 text-white" : "bg-white"}`}
                onClick={() => setCurrentHalf(2)}
              >
                2:a
              </button>
            </div>
          </div>
        </div>

        <div className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-slate-900">
            <div className="truncate text-right text-sm font-bold text-slate-700 sm:text-base">
              {homeLabel}
            </div>
            <div className="flex min-w-[6.5rem] items-center justify-center gap-2 tabular-nums">
              <span className="w-8 text-right text-3xl font-extrabold leading-none">{liveHome}</span>
              <span className="text-2xl font-bold leading-none text-slate-400">–</span>
              <span className="w-8 text-left text-3xl font-extrabold leading-none">{liveAway}</span>
            </div>
            <div className="truncate text-left text-sm font-bold text-slate-700 sm:text-base">
              {awayLabel}
            </div>
          </div>
        </div>

      </div>

      {/* Vy-väljare + toppknappar */}
      <div className="mb-4 flex items-center gap-2">
        <div className="inline-flex rounded-xl overflow-hidden border">
          <button
            className={`px-4 py-2 text-sm font-semibold ${viewMode === "match" ? "bg-blue-600 text-white" : "bg-white"}`}
            onClick={() => setViewMode("match")}
          >
            Matchvy
          </button>
          <button
            className={`px-4 py-2 text-sm font-semibold ${viewMode === "stats" ? "bg-blue-600 text-white" : "bg-white"}`}
            onClick={() => setViewMode("stats")}
          >
            Statistikvy
          </button>
        </div>

        <div className="flex gap-2 flex-wrap ml-auto">
          <button onClick={onOpenLog} className="bg-slate-800 text-white px-4 py-2 rounded-xl">Händelser</button>
          <button onClick={undoLast} className="bg-red-500 text-white px-4 py-2 rounded-xl">Ångra senaste</button>
          <button onClick={onReset} className="bg-yellow-500 text-white px-4 py-2 rounded-xl">Avsluta match</button>
        </div>
      </div>

    </>
  );
}
