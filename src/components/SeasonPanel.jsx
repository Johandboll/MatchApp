import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentSeasonDefinition, getLatestSeasonBefore } from "../lib/seasonHelpers";

export default function SeasonPanel({
  open,
  team,
  onSeasonChange,
  seasons = [],
  loading = false,
  error = "",
  onRefresh,
  onToast,
  onClose,
  today = null
}) {
  const currentDefinition = useMemo(() => getCurrentSeasonDefinition(today || new Date()), [today]);
  const currentSeason = seasons.find((season) => season.season_name === currentDefinition.name) || null;
  const sourceSeason = getLatestSeasonBefore(seasons, currentDefinition.name);
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [players, setPlayers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");

  const loadWizard = useCallback(async () => {
    setStep(1);
    setDisplayName(sourceSeason?.display_name || team?.name || "");
    setPlayers([]);
    setLocalError("");

    if (!sourceSeason?.team_season_id || !team?.onlineId) return;
    setBusy(true);
    const { data, error: rosterError } = await supabase.rpc("list_team_season_roster", {
      target_team_id: team.onlineId,
      target_team_season_id: sourceSeason.team_season_id
    });
    setBusy(false);

    if (rosterError) {
      setLocalError(rosterError.message);
      return;
    }

    setPlayers((data || []).map((player) => ({
      ...player,
      selected: Boolean(player.included && player.active),
      nextShirtNumber: player.shirt_number ?? "",
      nextRole: player.player_role || "field"
    })));
  }, [sourceSeason, team?.name, team?.onlineId]);

  useEffect(() => {
    if (open) loadWizard();
  }, [loadWizard, open]);

  if (!open) return null;

  const updatePlayer = (playerId, changes) => {
    setPlayers((current) => current.map((player) =>
      player.player_identity_id === playerId ? { ...player, ...changes } : player
    ));
  };

  const selectedPlayers = players.filter((player) => player.selected);

  const createSeason = async () => {
    if (!supabase || !team?.onlineId || currentSeason || !displayName.trim()) return;
    setBusy(true);
    setLocalError("");

    const { data, error: createError } = await supabase.rpc("create_team_season", {
      target_team_id: team.onlineId,
      new_season_name: currentDefinition.name,
      new_starts_on: currentDefinition.startsOn,
      new_ends_on: currentDefinition.endsOn,
      new_display_name: displayName.trim(),
      copy_from_team_season_id: sourceSeason?.team_season_id || null
    });

    if (createError) {
      setLocalError(createError.message);
      setBusy(false);
      return;
    }

    const createdSeason = (data || []).find((season) => season.season_name === currentDefinition.name);
    if (!createdSeason?.team_season_id) {
      setLocalError("Säsongen skapades men kunde inte öppnas. Ladda om och försök igen.");
      setBusy(false);
      return;
    }

    for (const player of players) {
      const { error: rosterError } = await supabase.rpc("set_team_season_roster_player", {
        target_team_id: team.onlineId,
        target_team_season_id: createdSeason.team_season_id,
        target_player_identity_id: player.player_identity_id,
        new_shirt_number: player.nextShirtNumber === "" ? null : Number(player.nextShirtNumber),
        new_player_role: player.nextRole,
        is_included: player.selected
      });

      if (rosterError) {
        setLocalError(`Säsongen skapades, men truppen kunde inte färdigställas: ${rosterError.message}`);
        setBusy(false);
        onSeasonChange?.(currentDefinition.name);
        await onRefresh?.(currentDefinition.name);
        return;
      }
    }

    onSeasonChange?.(currentDefinition.name);
    await onRefresh?.(currentDefinition.name);
    setBusy(false);
    onToast?.("Den nya säsongen är klar");
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[80] overscroll-contain bg-slate-950/55 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Ny säsong">
      <div className="mx-auto flex h-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold uppercase tracking-wide text-sky-700">{team?.name}</div>
            <h2 className="text-xl font-extrabold text-slate-900">Ny säsong</h2>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">Stäng</button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4">
          {(error || localError) && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{localError || error}</div>}

          <div className="mb-5 flex items-center gap-2" aria-label={`Steg ${step} av 3`}>
            {[1, 2, 3].map((item) => <span key={item} className={`h-2 flex-1 rounded-full ${item <= step ? "bg-sky-600" : "bg-slate-200"}`} />)}
          </div>

          {step === 1 && (
            <section>
              <h3 className="text-lg font-extrabold text-slate-900">Lag och säsong</h3>
              <p className="mt-1 text-sm text-slate-600">Säsongen väljs automatiskt efter brytdatumet den 1 juni.</p>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Ny säsong</div>
                <div className="mt-1 text-xl font-extrabold text-slate-900">{currentDefinition.name}</div>
              </div>
              <label className="mt-4 block text-sm font-semibold text-slate-700">Lagets namn under den nya säsongen
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
              </label>
              <p className="mt-2 text-xs text-slate-500">Tidigare matcher behåller lagets gamla namn.</p>
            </section>
          )}

          {step === 2 && (
            <section>
              <h3 className="text-lg font-extrabold text-slate-900">Spelare som fortsätter</h3>
              <p className="mt-1 text-sm text-slate-600">Aktiva spelare är redan valda. Ändra nummer eller roll om det behövs.</p>
              {busy || loading ? <div className="mt-4 text-sm text-slate-500">Hämtar spelarna...</div> : players.length === 0 ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">Laget har inga tidigare spelare. Du kan lägga till spelare efter att säsongen startats.</div>
              ) : (
                <div className="mt-4 space-y-2">
                  {players.map((player) => (
                    <div key={player.player_identity_id} className={`rounded-xl border p-3 ${player.selected ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-white"}`}>
                      <label className="flex cursor-pointer items-center gap-3">
                        <input type="checkbox" checked={player.selected} onChange={(event) => updatePlayer(player.player_identity_id, { selected: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-sky-600" />
                        <span className="min-w-0 flex-1 truncate font-bold text-slate-900">{player.display_name}</span>
                      </label>
                      {player.selected && (
                        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-2 pl-7">
                          <label className="text-xs font-semibold text-slate-600">Tröjnummer
                            <input type="number" min="0" max="999" value={player.nextShirtNumber} onChange={(event) => updatePlayer(player.player_identity_id, { nextShirtNumber: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" />
                          </label>
                          <label className="text-xs font-semibold text-slate-600">Roll
                            <select value={player.nextRole} onChange={(event) => updatePlayer(player.player_identity_id, { nextRole: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
                              <option value="field">Utespelare</option>
                              <option value="goalkeeper">Målvakt</option>
                            </select>
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {step === 3 && (
            <section>
              <h3 className="text-lg font-extrabold text-slate-900">Kontrollera och starta</h3>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xl font-extrabold text-slate-900">{displayName}</div>
                <div className="mt-1 font-semibold text-slate-700">{currentDefinition.name}</div>
                <div className="mt-3 text-sm text-slate-700">{selectedPlayers.length} spelare följer med.</div>
              </div>
              <p className="mt-3 text-sm text-slate-600">Spelarnas identitet och all tidigare matchstatistik behålls.</p>
            </section>
          )}

          <div className="mt-6 flex justify-between gap-2 border-t border-slate-200 pt-4">
            <button type="button" disabled={busy} onClick={() => step === 1 ? onClose?.() : setStep((current) => current - 1)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">{step === 1 ? "Avbryt" : "Tillbaka"}</button>
            {step < 3 ? (
              <button type="button" disabled={busy || (step === 1 && !displayName.trim())} onClick={() => setStep((current) => current + 1)} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Fortsätt</button>
            ) : (
              <button type="button" disabled={busy} onClick={createSeason} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Startar..." : "Starta säsongen"}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
