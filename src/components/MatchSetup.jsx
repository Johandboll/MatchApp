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
    <div>
      <h1 className="text-xl font-bold mb-4">Matchinformation</h1>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpenSeason}
          className="border px-3 py-2 rounded-xl bg-white/80"
        >
          📊 Säsong
        </button>
        {onOpenTeamAdmin && (
          <button
            type="button"
            onClick={onOpenTeamAdmin}
            className="border px-3 py-2 rounded-xl bg-white/80"
          >
            Lagadmin
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {isMobile ? (
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Datum"
              className="border p-2 rounded w-full text-base pointer-events-none select-none"
              value={matchInfo.date}
              readOnly
            />
            <input
              id="match-date"
              type="date"
              name="date"
              className="absolute inset-0 w-full h-full z-10 opacity-[0.01] cursor-pointer border-0 p-0 m-0 bg-transparent text-transparent caret-transparent appearance-none"
              onChange={onMatchInfoChange}
              value={matchInfo.date}
              aria-label="Datum"
            />
          </div>
        ) : (
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Datum"
              className="border p-2 rounded w-full text-base cursor-pointer"
              value={matchInfo.date}
              readOnly
              onClick={openDatePicker}
            />
            <input
              ref={dateInputRef}
              id="match-date"
              type="date"
              name="date"
              className="absolute inset-0 w-0 h-0 opacity-0 pointer-events-none"
              onChange={onMatchInfoChange}
              value={matchInfo.date}
              aria-label="Datum"
            />
          </div>
        )}
        <input
          type="text"
          name="opponent"
          placeholder="Motståndare"
          className="border p-2 rounded w-full text-base"
          onChange={onMatchInfoChange}
          value={matchInfo.opponent}
        />
        <select
          name="location"
          className="border p-2 rounded w-full text-base"
          onChange={onMatchInfoChange}
          value={matchInfo.location}
        >
          <option value="">Välj plats</option>
          <option value="Hemma">Hemma</option>
          <option value="Borta">Borta</option>
        </select>
      </div>

      <h2 className="text-lg font-semibold mb-2">Välj spelare som är med i matchen</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {playersForUI.map((player) => {
          const playerId = getPlayerId(player);
          const shirtNumber = getPlayerShirtNumber(player);
          const selected = selectedPlayers.includes(playerId);
          const isGoalkeeper = player.role === "goalkeeper";
          const baseClass = "p-2 border rounded-xl text-left transition-colors";
          const content = `#${shirtNumber} ${player.name}${isGoalkeeper ? " (MV)" : ""}`;

          if (isGoalkeeper) {
            return (
              <button
                key={playerId}
                className={`${baseClass} ${
                  selected
                    ? "bg-yellow-300 border-yellow-700 text-black"
                    : "bg-yellow-50 hover:bg-yellow-100 border-yellow-300 text-black"
                }`}
                onClick={() => onTogglePlayer(playerId)}
              >
                {content}
              </button>
            );
          }

          return (
            <button
              key={playerId}
              className={`${baseClass} ${
                selected
                  ? "bg-blue-500 border-blue-700 text-white"
                  : "bg-blue-50 hover:bg-blue-100 border-blue-300 text-black"
              }`}
              onClick={() => onTogglePlayer(playerId)}
            >
              {content}
            </button>
          );
        })}
      </div>

      <div className="mb-6 p-3 border rounded-xl bg-white/60">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={cupPanelOpen}
            onChange={(e) => {
              const checked = e.target.checked;
              setCupPanelOpen(checked);
              setCupEnabled(checked);
              if (!checked) setCupPhase("");
            }}
          />
          <span className="font-medium">Ange cup/turnering</span>
        </label>

        {cupPanelOpen && (
          <div className="mt-3">
            <input
              type="text"
              placeholder="Cup/turneringens namn (valfritt)"
              className="border p-2 rounded w-full"
              value={cupName}
              onChange={(e) => setCupName(e.target.value)}
            />
            <div className="mt-2">
              <label className="block text-sm mb-1">Cupfas</label>
              <select
                value={cupPhase}
                onChange={(e) => setCupPhase(e.target.value)}
                className="border p-2 rounded w-full"
              >
                <option value="">(ingen)</option>
                <option value="Grupp">Grupp</option>
                <option value="Åttondel">Åttondel</option>
                <option value="Kvart">Kvart</option>
                <option value="Semi">Semi</option>
                <option value="Final">Final</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onStartMatch}
        disabled={!canStartMatch}
        className={`mt-2 px-4 py-2 rounded-xl text-white ${
          canStartMatch ? "bg-green-600" : "bg-gray-400 cursor-not-allowed"
        }`}
      >
        Starta match
      </button>

      <div className="mt-2 text-xs text-gray-500">
        <button onClick={onChangeTeam} className="underline hover:text-gray-700">
          Byt lag
        </button>
      </div>

      <div className="mt-3 text-xs text-gray-500">
        <Tooltip content={changelogTooltip}>
          <span>Version: {appVersion}</span>
        </Tooltip>
      </div>
    </div>
  );
}
