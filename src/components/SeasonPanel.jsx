import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentSeasonDefinition, getLatestSeasonBefore } from "../lib/seasonHelpers";

const formatSeasonDates = (season) => {
  if (season?.season_name === "Historik före säsongsindelning") return "Importerad historik";
  if (!season?.starts_on || !season?.ends_on) return "";
  return `${season.starts_on} – ${season.ends_on}`;
};

export default function SeasonPanel({
  open,
  team,
  selectedSeason,
  onSeasonChange,
  seasons = [],
  activeTeamSeason,
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
  const overviewSeason = currentSeason || activeTeamSeason;
  const previousSeasons = seasons.filter((season) => season.team_season_id !== overviewSeason?.team_season_id);
  const [view, setView] = useState("overview");
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [sourceRoster, setSourceRoster] = useState([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");

  const latestPlayers = sourceRoster.filter((player) => player.included && player.active);
  const previousPlayers = sourceRoster.filter((player) => !(player.included && player.active));

  useEffect(() => {
    if (!open) return;
    setView("overview");
    setStep(1);
    setLocalError("");
  }, [open, team?.onlineId]);

  if (!open) return null;

  const startWizard = async () => {
    setDisplayName(sourceSeason?.display_name || team?.name || "");
    setSourceRoster([]);
    setSelectedPlayerIds(new Set());
    setLocalError("");
    setStep(1);
    setView("wizard");

    if (!sourceSeason?.team_season_id) return;

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

    const players = data || [];
    setSourceRoster(players);
    setSelectedPlayerIds(new Set(
      players
        .filter((player) => player.included && player.active)
        .map((player) => player.player_identity_id)
    ));
  };

  const togglePlayer = (playerId) => {
    setSelectedPlayerIds((current) => {
      const next = new Set(current);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  };

  const createSeason = async () => {
    if (!supabase || !team?.onlineId || currentSeason) return;
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
    const rosterChanges = sourceRoster.filter((player) => {
      const wasIncluded = player.included && player.active;
      return wasIncluded !== selectedPlayerIds.has(player.player_identity_id);
    });

    for (const player of rosterChanges) {
      const { error: rosterError } = await supabase.rpc("set_team_season_roster_player", {
        target_team_id: team.onlineId,
        target_team_season_id: createdSeason?.team_season_id,
        target_player_identity_id: player.player_identity_id,
        new_shirt_number: player.shirt_number,
        new_player_role: player.player_role || "field",
        is_included: selectedPlayerIds.has(player.player_identity_id)
      });

      if (rosterError) {
        setLocalError(`Säsongen skapades, men truppen kunde inte färdigställas: ${rosterError.message}`);
        setBusy(false);
        onSeasonChange?.(currentDefinition.name);
        await onRefresh?.(currentDefinition.name);
        setView("overview");
        return;
      }
    }

    onSeasonChange?.(currentDefinition.name);
    await onRefresh?.(currentDefinition.name);
    setBusy(false);
    setView("overview");
    onToast?.("Säsongen startades");
  };

  return (
    <div className="fixed inset-0 z-[80] overscroll-contain bg-slate-950/55 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Hantera säsong">
      <div className="mx-auto flex h-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">{team?.name}</div>
            <h2 className="text-xl font-extrabold text-slate-900">Hantera säsong</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Stäng</button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4">
          {(error || localError) && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{localError || error}</div>
          )}

          {view === "overview" && (
            <>
              <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-sky-700">{currentSeason ? "Aktuell säsong" : "Nuvarande trupp"}</div>
                {loading ? (
                  <div className="mt-2 text-sm text-slate-600">Hämtar säsongen...</div>
                ) : overviewSeason ? (
                  <div className="mt-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-xl font-extrabold text-slate-900">{overviewSeason.display_name}</div>
                      {selectedSeason === overviewSeason.season_name && <span className="rounded-full bg-sky-600 px-2 py-0.5 text-xs font-bold text-white">Visas nu</span>}
                    </div>
                    <div className="text-sm font-semibold text-slate-700">{overviewSeason.season_name}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatSeasonDates(overviewSeason)}{formatSeasonDates(overviewSeason) ? " · " : ""}{overviewSeason.active_player_count} spelare</div>
                    {selectedSeason !== overviewSeason.season_name && (
                      <button type="button" onClick={() => onSeasonChange?.(overviewSeason.season_name)} className="mt-3 rounded-xl bg-sky-600 px-3 py-2 text-sm font-bold text-white">Visa aktuell säsong</button>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-slate-600">Ingen databaskopplad säsong är vald.</div>
                )}
              </section>

              {!currentSeason && (
                <button type="button" onClick={startWizard} className="mt-4 w-full rounded-2xl bg-sky-600 px-4 py-3 text-base font-extrabold text-white hover:bg-sky-700">Starta ny säsong</button>
              )}

              {previousSeasons.length > 0 && (
                <section className="mt-6">
                  <h3 className="text-base font-extrabold text-slate-900">Tidigare säsonger</h3>
                  <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                    {previousSeasons.map((season) => (
                      <button key={season.team_season_id} type="button" onClick={() => onSeasonChange?.(season.season_name)} className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-b-0 hover:bg-slate-50">
                        <span><span className="block font-bold text-slate-900">{season.display_name}</span><span className="block text-xs text-slate-500">{season.season_name} · {season.active_player_count} spelare</span></span>
                        <span className="text-sm font-semibold text-sky-700">{selectedSeason === season.season_name ? "Visas nu" : "Visa"}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {view === "wizard" && (
            <>
              <div className="mb-5 flex items-center gap-2" aria-label={`Steg ${step} av 3`}>
                {[1, 2, 3].map((item) => <span key={item} className={`h-2 flex-1 rounded-full ${item <= step ? "bg-sky-600" : "bg-slate-200"}`} />)}
              </div>

              {step === 1 && (
                <section>
                  <h3 className="text-lg font-extrabold text-slate-900">1. Kontrollera säsongen</h3>
                  <p className="mt-1 text-sm text-slate-600">Säsongen väljs automatiskt utifrån brytdatumet den 1 juni.</p>
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Ny säsong</div>
                    <div className="mt-1 text-xl font-extrabold text-slate-900">{currentDefinition.name}</div>
                  </div>
                  <label className="mt-4 block text-sm font-semibold text-slate-700">Lagets namn under säsongen
                    <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
                  </label>
                  <p className="mt-2 text-xs text-slate-500">Tidigare säsonger behåller sina gamla lagnamn.</p>
                </section>
              )}

              {step === 2 && (
                <section>
                  <h3 className="text-lg font-extrabold text-slate-900">2. Välj spelare som fortsätter</h3>
                  <p className="mt-1 text-sm text-slate-600">Aktiva spelare från senaste säsongen är redan markerade.</p>
                  {busy ? (
                    <div className="mt-4 text-sm text-slate-500">Hämtar spelarna...</div>
                  ) : latestPlayers.length === 0 && previousPlayers.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">Laget har inga tidigare spelare. Spelare kan läggas till efter att säsongen startats.</div>
                  ) : (
                    <>
                      {latestPlayers.length > 0 && (
                        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                          {latestPlayers.map((player) => (
                            <label key={player.player_identity_id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0">
                              <input type="checkbox" checked={selectedPlayerIds.has(player.player_identity_id)} onChange={() => togglePlayer(player.player_identity_id)} className="h-4 w-4 rounded border-slate-300 text-sky-600" />
                              <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">{player.display_name}</span>
                              <span className="text-sm text-slate-500">#{player.shirt_number ?? "–"}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      {previousPlayers.length > 0 && (
                        <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <summary className="cursor-pointer font-bold text-slate-800">Tidigare spelare i laget</summary>
                          <p className="mt-1 text-xs text-slate-500">Markera någon som ska komma tillbaka.</p>
                          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                            {previousPlayers.map((player) => (
                              <label key={player.player_identity_id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0">
                                <input type="checkbox" checked={selectedPlayerIds.has(player.player_identity_id)} onChange={() => togglePlayer(player.player_identity_id)} className="h-4 w-4 rounded border-slate-300 text-sky-600" />
                                <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">{player.display_name}</span>
                                <span className="text-sm text-slate-500">#{player.shirt_number ?? "–"}</span>
                              </label>
                            ))}
                          </div>
                        </details>
                      )}
                    </>
                  )}
                </section>
              )}

              {step === 3 && (
                <section>
                  <h3 className="text-lg font-extrabold text-slate-900">3. Bekräfta</h3>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xl font-extrabold text-slate-900">{displayName}</div>
                    <div className="mt-1 font-semibold text-slate-700">{currentDefinition.name}</div>
                    <div className="mt-3 text-sm text-slate-700">{selectedPlayerIds.size} spelare följer med till den nya säsongen.</div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">Laget och all tidigare matchhistorik behålls.</p>
                </section>
              )}

              <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-4">
                <button type="button" disabled={busy} onClick={() => step === 1 ? setView("overview") : setStep((current) => current - 1)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">{step === 1 ? "Avbryt" : "Tillbaka"}</button>
                {step < 3 ? (
                  <button type="button" disabled={busy || (step === 1 && !displayName.trim())} onClick={() => setStep((current) => current + 1)} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Fortsätt</button>
                ) : (
                  <button type="button" disabled={busy} onClick={createSeason} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Startar..." : "Starta säsongen"}</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
