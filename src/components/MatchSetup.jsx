import React, { useMemo, useRef } from "react";
import Tooltip from "./Tooltip";

export default function MatchSetup({
  matchInfo,
  onMatchInfoChange,
  onOpenSeason,
  onOpenTeamAdmin,
  playersForUI,
  selectedPlayers,
  onTogglePlayer,
  cupPanelOpen,
  setCupPanelOpen,
  setCupEnabled,
  cupName,
  setCupName,
  cupPhase,
  setCupPhase,
  onStartMatch,
  canStartMatch,
  onChangeTeam,
  appVersion,
  changelogTooltip
}) {
  const dateInputRef = useRef(null);

  const isMobile = useMemo(() => {
    try {
      return window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    } catch {
      return false;
    }
  }, []);

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
      } else {
        input.focus();
        input.click();
      }
    } catch {
      try {
        input.focus();
        input.click();
      } catch {}
    }
  };

  const getPlayerId = (player) => player.id ?? player.nr;
  const getPlayerShirtNumber = (player) => player.shirtNumber ?? player.nr;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">MatchApp</div>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Ny match</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenSeason}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Säsong
          </button>
          {onOpenTeamAdmin && (
            <button
              type="button"
              onClick={onOpenTeamAdmin}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Lagadmin
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-base font-bold text-slate-900">Matchinformation</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Datum</span>
            {isMobile ? (
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Välj datum"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base pointer-events-none select-none"
                  value={matchInfo.date}
                  readOnly
                />
                <input
                  id="match-date"
                  type="date"
                  name="date"
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none border-0 bg-transparent p-0 m-0 opacity-[0.01] text-transparent caret-transparent"
                  onChange={onMatchInfoChange}
                  value={matchInfo.date}
                  aria-label="Datum"
                />
              </div>
            ) : (
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Välj datum"
                  className="w-full cursor-pointer rounded-xl border border-slate-300 px-3 py-2.5 text-base"
                  value={matchInfo.date}
                  readOnly
                  onClick={openDatePicker}
                />
                <input
                  ref={dateInputRef}
                  id="match-date"
                  type="date"
                  name="date"
                  className="absolute inset-0 h-0 w-0 opacity-0 pointer-events-none"
                  onChange={onMatchInfoChange}
                  value={matchInfo.date}
                  aria-label="Datum"
                />
              </div>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Motståndare</span>
            <input
              type="text"
              name="opponent"
              placeholder="Motståndare"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base"
              onChange={onMatchInfoChange}
              value={matchInfo.opponent}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Plats</span>
            <select
              name="location"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base"
              onChange={onMatchInfoChange}
              value={matchInfo.location}
            >
              <option value="">Välj plats</option>
              <option value="Hemma">Hemma</option>
              <option value="Borta">Borta</option>
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-base font-bold text-slate-900">Spelare</div>
            <div className="text-sm text-slate-500">{selectedPlayers.length} valda</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {playersForUI.map((player) => {
            const playerId = getPlayerId(player);
            const shirtNumber = getPlayerShirtNumber(player);
            const selected = selectedPlayers.includes(playerId);
            const isGoalkeeper = player.role === "goalkeeper";
            const baseClass =
              "min-h-[56px] rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors";

            return (
              <button
                key={playerId}
                className={`${baseClass} ${
                  selected
                    ? isGoalkeeper
                      ? "border-amber-600 bg-amber-300 text-slate-950"
                      : "border-sky-700 bg-sky-600 text-white"
                    : isGoalkeeper
                      ? "border-amber-300 bg-amber-50 text-slate-900 hover:bg-amber-100"
                      : "border-sky-200 bg-sky-50 text-slate-900 hover:bg-sky-100"
                }`}
                onClick={() => onTogglePlayer(playerId)}
              >
                <span className="block">#{shirtNumber}</span>
                <span className="block truncate">{player.name}</span>
                {isGoalkeeper && <span className="block text-xs font-bold opacity-70">Målvakt</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={cupPanelOpen}
            onChange={(e) => {
              const checked = e.target.checked;
              setCupPanelOpen(checked);
              setCupEnabled(checked);
              if (!checked) setCupPhase("");
            }}
            className="h-5 w-5"
          />
          <span className="font-semibold text-slate-800">Cup/turnering</span>
        </label>

        {cupPanelOpen && (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              type="text"
              placeholder="Cup/turneringens namn (valfritt)"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base"
              value={cupName}
              onChange={(e) => setCupName(e.target.value)}
            />
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Cupfas</span>
              <select
                value={cupPhase}
                onChange={(e) => setCupPhase(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base"
              >
                <option value="">(ingen)</option>
                <option value="Grupp">Grupp</option>
                <option value="Åttondel">Åttondel</option>
                <option value="Kvart">Kvart</option>
                <option value="Semi">Semi</option>
                <option value="Final">Final</option>
              </select>
            </label>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={onStartMatch}
          disabled={!canStartMatch}
          className={`rounded-xl px-5 py-3 text-base font-extrabold text-white shadow-sm ${
            canStartMatch ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-400 cursor-not-allowed"
          }`}
        >
          Starta match
        </button>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <button onClick={onChangeTeam} className="font-semibold underline hover:text-slate-700">
            Byt lag
          </button>
          <Tooltip content={changelogTooltip}>
            <span>Version: {appVersion}</span>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
