import React, { useState } from "react";

export default function TopBar({
  currentHalf, setCurrentHalf,
  viewMode, setViewMode,
  undoLast, onReset,
  matchInfo, selectedTeam, liveHome, liveAway,
  cupLabel,
  onOpenLog,
  onOpenRoster
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const ourTeamName = selectedTeam?.name || "Vi";
  const opponentName = matchInfo?.opponent || "Mot";
  const isAway = (matchInfo?.location || "") === "Borta";
  const homeLabel = isAway ? opponentName : ourTeamName;
  const awayLabel = isAway ? ourTeamName : opponentName;

  return (
    <>
      <div
        className={`match-phone-only match-phone-topbar sticky top-0 -mx-4 mb-3 border-b border-slate-200 bg-slate-50/95 px-4 pb-3 pt-2 backdrop-blur ${moreOpen ? "z-[60]" : "z-20"}`}
        onClick={() => {
          if (moreOpen) setMoreOpen(false);
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-600">
          <div className="min-w-0 truncate font-semibold">
            {matchInfo?.date || "-"} · {matchInfo?.location || "-"}{cupLabel ? ` · ${cupLabel}` : ""}
          </div>
          <div className="inline-flex shrink-0 overflow-hidden rounded-xl border bg-white">
            <button
              type="button"
              className={`min-h-[36px] px-3 text-xs font-semibold ${currentHalf === 1 ? "bg-green-600 text-white" : "text-slate-700"}`}
              onClick={() => setCurrentHalf(1)}
            >
              1:a
            </button>
            <button
              type="button"
              className={`min-h-[36px] px-3 text-xs font-semibold ${currentHalf === 2 ? "bg-green-600 text-white" : "text-slate-700"}`}
              onClick={() => setCurrentHalf(2)}
            >
              2:a
            </button>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm">
          <div className="truncate text-right text-sm font-bold text-slate-700">{homeLabel}</div>
          <div className="flex min-w-[6.5rem] items-center justify-center gap-2 tabular-nums">
            <span className="w-8 text-right text-3xl font-extrabold leading-none">{liveHome}</span>
            <span className="text-2xl font-bold leading-none text-slate-400">–</span>
            <span className="w-8 text-left text-3xl font-extrabold leading-none">{liveAway}</span>
          </div>
          <div className="truncate text-left text-sm font-bold text-slate-700">{awayLabel}</div>
        </div>

        <div className="relative grid grid-cols-2 gap-2">
          <button type="button" onClick={undoLast} className="min-h-[42px] rounded-xl bg-red-500 px-2 text-sm font-semibold text-white">
            Ångra
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setMoreOpen((open) => !open);
            }}
            className="min-h-[42px] rounded-xl bg-slate-700 px-2 text-sm font-semibold text-white"
            aria-expanded={moreOpen}
            aria-haspopup="menu"
          >
            Mer
          </button>
          <button
            type="button"
            onClick={onOpenLog}
            className="min-h-[42px] rounded-xl bg-slate-800 px-2 text-sm font-semibold text-white"
          >
            Händelser
          </button>
          <button
            type="button"
            className="min-h-[42px] rounded-xl bg-blue-600 px-2 text-sm font-semibold text-white"
            onClick={() => setViewMode(viewMode === "match" ? "stats" : "match")}
          >
            {viewMode === "match" ? "Statistik" : "Match"}
          </button>

        </div>
      </div>

      {moreOpen && (
        <>
          <button
            type="button"
            className="match-phone-only fixed inset-0 z-[80] cursor-default bg-transparent"
            onClick={() => setMoreOpen(false)}
            aria-label="Stäng Mer"
          />
          <div
            role="menu"
            className="match-phone-only fixed right-4 top-[8.75rem] z-[90] w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onOpenRoster?.();
              }}
              className="w-full rounded-xl px-3 py-3 text-left text-sm font-bold text-slate-800 hover:bg-slate-100"
            >
              Trupp
            </button>
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onReset?.();
              }}
              className="mt-1 w-full rounded-xl px-3 py-3 text-left text-sm font-bold text-amber-800 hover:bg-amber-50"
            >
              Avsluta match
            </button>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="mt-1 w-full rounded-xl px-3 py-3 text-left text-sm font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              Stäng
            </button>
          </div>
        </>
      )}

      <div className="match-tablet-only">
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
          <button onClick={onOpenRoster} className="bg-slate-700 text-white px-4 py-2 rounded-xl">Trupp</button>
          <button onClick={undoLast} className="bg-red-500 text-white px-4 py-2 rounded-xl">Ångra senaste</button>
          <button onClick={onReset} className="bg-yellow-500 text-white px-4 py-2 rounded-xl">Avsluta match</button>
        </div>
      </div>

      </div>

    </>
  );
}
