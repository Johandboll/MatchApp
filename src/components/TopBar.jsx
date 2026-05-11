import React from "react";

export default function TopBar({
  currentHalf, setCurrentHalf,
  viewMode, setViewMode,
  undoLast, onReset,
  matchInfo, liveHome, liveAway,
  cupLabel
}) {
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

        <div className="mt-2 w-full bg-gray-100 rounded-2xl p-3 flex items-center justify-center shadow">
          <div className="text-2xl font-bold tracking-wide">
            Resultat: <span className="text-green-700">{liveHome}</span> – <span className="text-red-700">{liveAway}</span>
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
          <button onClick={undoLast} className="bg-red-500 text-white px-4 py-2 rounded-xl">Ångra senaste</button>
          <button onClick={onReset} className="bg-yellow-500 text-white px-4 py-2 rounded-xl">Avsluta match</button>
        </div>
      </div>

    </>
  );
}
