import React, { useMemo, useRef, useState } from "react";
import Tooltip from "./Tooltip";

export default function MatchSetup({
  matchInfo,
  onMatchInfoChange,
  onOpenSeason,
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
  extraPanelOpen,
  setExtraPanelOpen,
  extraPlayers,
  onAddExtraPlayer,
  onRemoveExtraPlayer,
  onClearExtraPlayers,
  onStartMatch,
  canStartMatch,
  onChangeTeam,
  appVersion,
  changelogTooltip
}) {
  const [extraPlayerForm, setExtraPlayerForm] = useState({
    nr: "",
    name: "",
    role: ""
  });
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

  const submitExtraPlayer = () => {
    const added = onAddExtraPlayer(extraPlayerForm);
    if (added) {
      setExtraPlayerForm({ nr: "", name: "", role: "" });
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Matchinformation</h1>
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={onOpenSeason}
          className="border px-3 py-2 rounded-xl bg-white/80"
        >
          📊 Säsong
        </button>
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
          const selected = selectedPlayers.includes(player.nr);
          const isGoalkeeper = player.role === "goalkeeper";
          const baseClass = "p-2 border rounded-xl text-left transition-colors";
          const content = `#${player.nr} ${player.name}${isGoalkeeper ? " (MV)" : ""}`;

          if (isGoalkeeper) {
            return (
              <button
                key={player.nr}
                className={`${baseClass} ${
                  selected
                    ? "bg-yellow-300 border-yellow-700 text-black"
                    : "bg-yellow-50 hover:bg-yellow-100 border-yellow-300 text-black"
                }`}
                onClick={() => onTogglePlayer(player.nr)}
              >
                {content}
              </button>
            );
          }

          return (
            <button
              key={player.nr}
              className={`${baseClass} ${
                selected
                  ? "bg-blue-500 border-blue-700 text-white"
                  : "bg-blue-50 hover:bg-blue-100 border-blue-300 text-black"
              }`}
              onClick={() => onTogglePlayer(player.nr)}
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

      <div className="mb-6 p-3 border rounded-xl bg-white/60">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={extraPanelOpen}
            onChange={(e) => setExtraPanelOpen(e.target.checked)}
          />
          <span className="font-medium">Lägg till extra spelare vid behov</span>
        </label>

        {extraPanelOpen && (
          <div className="mt-3">
            <h2 className="text-lg font-semibold mb-2">Extra spelare för denna cup/match</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {extraPlayers.length === 0 && (
                <div className="text-sm text-gray-500">Inga extra spelare tillagda ännu.</div>
              )}
              {extraPlayers.map((player) => (
                <span
                  key={player.nr}
                  className="inline-flex items-center gap-2 px-2 py-1 border rounded-lg bg-white"
                >
                  #{player.nr} {player.name}
                  {player.role === "goalkeeper" ? " (MV)" : ""}
                  <button
                    className="text-red-600 font-bold"
                    onClick={() => onRemoveExtraPlayer(player.nr)}
                    title="Ta bort"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="number"
                inputMode="numeric"
                placeholder="Nummer"
                className="border p-2 rounded"
                value={extraPlayerForm.nr}
                onChange={(e) =>
                  setExtraPlayerForm((prev) => ({ ...prev, nr: e.target.value }))
                }
              />
              <input
                type="text"
                placeholder="Namn"
                className="border p-2 rounded sm:col-span-2"
                value={extraPlayerForm.name}
                onChange={(e) =>
                  setExtraPlayerForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
              <select
                className="border p-2 rounded"
                value={extraPlayerForm.role}
                onChange={(e) =>
                  setExtraPlayerForm((prev) => ({ ...prev, role: e.target.value }))
                }
              >
                <option value="">Utespelare</option>
                <option value="goalkeeper">Målvakt</option>
              </select>
              <button
                className="sm:col-span-4 mt-1 bg-blue-600 text-white px-3 py-2 rounded-xl"
                onClick={submitExtraPlayer}
              >
                Lägg till extra spelare
              </button>
              <button
                className="sm:col-span-4 bg-gray-200 text-gray-700 px-3 py-2 rounded-lg"
                onClick={onClearExtraPlayers}
              >
                Rensa alla extra spelare
              </button>
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
