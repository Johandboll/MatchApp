import React, { useCallback, useMemo, useState } from "react";
import TopBar from "./TopBar";
import MatchView from "./MatchView";
import StatsView from "./StatsView";
import { eventLabel } from "../lib/appHelpers";

export default function MatchSession({
  currentHalf,
  setCurrentHalf,
  viewMode,
  setViewMode,
  undoLast,
  onReset,
  matchInfo,
  selectedTeam,
  liveHome,
  liveAway,
  cupLabel,
  history,
  allPlayers,
  onDeleteHistoryItem,
  selectedPlayers,
  stats,
  increment,
  playersForUI,
  onToggleMatchPlayer,
  onConfirm
}) {
  const [logOpen, setLogOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);

  const getPlayerId = useCallback((player) => player?.id ?? player?.nr, []);
  const getPlayerShirtNumber = useCallback((player) => player?.shirtNumber ?? player?.nr, []);

  const playersByRef = useMemo(() => {
    const map = new Map();
    allPlayers.forEach((player) => {
      map.set(String(getPlayerId(player)), player);
      map.set(String(player.nr), player);
    });
    return map;
  }, [allPlayers, getPlayerId]);

  const playerMatchesRef = useCallback(
    (player, ref) => String(getPlayerId(player)) === String(ref) || String(player?.nr) === String(ref),
    [getPlayerId]
  );

  const playerHasActivity = useCallback(
    (player) => {
      const hasHistory = (history || []).some(
        (item) => playerMatchesRef(player, item?.playerId) || playerMatchesRef(player, item?.nr)
      );
      if (hasHistory) return true;

      const refs = [
        getPlayerId(player),
        player?.nr,
        player?.shirtNumber
      ]
        .filter((value) => value !== undefined && value !== null && value !== "")
        .map((value) => String(value));
      const playerStats = refs.map((ref) => stats?.[ref]).find(Boolean);
      if (!playerStats) return false;

      return Object.entries(playerStats).some(([key, value]) => {
        if (key === "byHalf") {
          return Object.values(value || {}).some((halfStats) =>
            Object.values(halfStats || {}).some((count) => Number(count) > 0)
          );
        }

        return Number(value) > 0;
      });
    },
    [getPlayerId, history, playerMatchesRef, stats]
  );

  return (
    <div>
      <TopBar
        currentHalf={currentHalf}
        setCurrentHalf={setCurrentHalf}
        viewMode={viewMode}
        setViewMode={setViewMode}
        undoLast={undoLast}
        onReset={onReset}
        matchInfo={matchInfo}
        selectedTeam={selectedTeam}
        liveHome={liveHome}
        liveAway={liveAway}
        cupLabel={cupLabel}
        onOpenLog={() => setLogOpen(true)}
        onOpenRoster={() => setRosterOpen(true)}
      />

      {(logOpen || rosterOpen) && (
        <button
          type="button"
          onClick={() => {
            setLogOpen(false);
            setRosterOpen(false);
          }}
          className="fixed inset-0 z-40 bg-black/20"
          aria-label="Stäng panel"
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-[340px] max-w-[90vw] z-50 bg-white shadow-2xl border-l border-black/10 transform transition-transform duration-200 ${
          logOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Händelselogg"
      >
        <div className="p-3 border-b flex items-center justify-between">
          <div className="font-semibold">Händelselogg</div>
          <button
            type="button"
            onClick={() => setLogOpen(false)}
            className="px-2 py-1 rounded-lg bg-gray-100"
            aria-label="Stäng"
          >
            Stäng
          </button>
        </div>

        <div className="p-3 overflow-auto h-[calc(100%-56px)]">
          {history.length === 0 ? (
            <div className="text-sm text-gray-500">Inga händelser ännu</div>
          ) : (
            <div className="space-y-2">
              {history
                .slice()
                .reverse()
                .map((item) => {
                  const player = playersByRef.get(String(item.playerId ?? item.nr)) || {
                    name: item.playerName || "",
                    role: item.playerRole === "goalkeeper" ? "goalkeeper" : undefined
                  };
                  const label = eventLabel(item.type, player);

                  return (
                    <div
                      key={item.id || `${item.playerId ?? item.nr}_${item.type}_${item.time || ""}`}
                      className="flex items-center justify-between gap-2 border rounded-xl p-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500">H{item.half}</div>
                        <div className="text-sm font-semibold truncate">
                          #{item.nr} {player?.name || ""}
                        </div>
                        <div className="mt-1 inline-flex items-center px-2 py-1 rounded-lg text-xs bg-gray-100">
                          {label}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          onConfirm?.({
                            title: "Radera händelse?",
                            message: "Händelsen tas bort från matchloggen och statistiken räknas om.",
                            confirmText: "Radera",
                            cancelText: "Avbryt",
                            variant: "danger",
                            onConfirm: () => onDeleteHistoryItem(item.id)
                          })
                        }
                        className="shrink-0 px-2 py-2 rounded-lg bg-red-50 hover:bg-red-100"
                        title="Radera"
                        aria-label="Radera händelse"
                      >
                        🗑️
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      <div
        className={`fixed top-0 right-0 h-full w-[380px] max-w-[92vw] z-50 bg-white shadow-2xl border-l border-black/10 transform transition-transform duration-200 ${
          rosterOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Matchtrupp"
      >
        <div className="p-3 border-b flex items-center justify-between">
          <div>
            <div className="font-semibold">Matchtrupp</div>
            <div className="text-xs text-gray-500">{selectedPlayers.length} valda</div>
          </div>
          <button
            type="button"
            onClick={() => setRosterOpen(false)}
            className="px-2 py-1 rounded-lg bg-gray-100"
            aria-label="Stäng"
          >
            Stäng
          </button>
        </div>

        <div className="h-[calc(100%-65px)] overflow-auto p-3">
          <div className="space-y-2">
            {(playersForUI || []).map((player) => {
              const playerId = getPlayerId(player);
              const shirtNumber = getPlayerShirtNumber(player);
              const selected = (selectedPlayers || []).some((ref) => playerMatchesRef(player, ref));
              const locked = selected && playerHasActivity(player);
              const isGoalkeeper = player.role === "goalkeeper";

              return (
                <button
                  key={playerId}
                  type="button"
                  onClick={() => onToggleMatchPlayer?.(playerId)}
                  className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                    selected
                      ? locked
                        ? "border-slate-300 bg-slate-100 text-slate-700"
                        : isGoalkeeper
                          ? "border-amber-600 bg-amber-200 text-slate-950"
                          : "border-sky-700 bg-sky-600 text-white"
                      : isGoalkeeper
                        ? "border-amber-300 bg-amber-50 text-slate-900 hover:bg-amber-100"
                        : "border-sky-200 bg-sky-50 text-slate-900 hover:bg-sky-100"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        #{shirtNumber} {player.name}
                      </div>
                      {isGoalkeeper && <div className="text-xs font-bold opacity-70">Målvakt</div>}
                    </div>
                    <div className="shrink-0 text-xs font-bold">
                      {selected ? (locked ? "Låst" : "Vald") : "Lägg till"}
                    </div>
                  </div>
                  {locked && (
                    <div className="mt-1 text-xs opacity-80">
                      Har händelser i matchen
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {viewMode === "match" ? (
        <MatchView
          allPlayers={allPlayers}
          selectedPlayers={selectedPlayers}
          stats={stats}
          increment={increment}
        />
      ) : (
        <StatsView allPlayers={playersForUI} selectedPlayers={selectedPlayers} stats={stats} />
      )}
    </div>
  );
}
