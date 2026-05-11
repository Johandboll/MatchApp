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
  onConfirm
}) {
  const [logOpen, setLogOpen] = useState(false);

  const getPlayerId = useCallback((player) => player?.id ?? player?.nr, []);

  const playersByRef = useMemo(() => {
    const map = new Map();
    allPlayers.forEach((player) => {
      map.set(String(getPlayerId(player)), player);
      map.set(String(player.nr), player);
    });
    return map;
  }, [allPlayers, getPlayerId]);

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
        liveHome={liveHome}
        liveAway={liveAway}
        cupLabel={cupLabel}
      />


      <button
        type="button"
        onClick={() => setLogOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-white/90 border border-black/20 shadow px-3 py-4 rounded-l-2xl text-sm font-semibold"
        style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        aria-label="Öppna händelselogg"
      >
        Händelselogg
      </button>

      {logOpen && (
        <button
          type="button"
          onClick={() => setLogOpen(false)}
          className="fixed inset-0 z-40 bg-black/20"
          aria-label="Stäng händelselogg"
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
                  const player = playersByRef.get(String(item.playerId ?? item.nr));
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
