import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const emptyForm = {
  name: "",
  displayName: "",
  startsOn: "",
  endsOn: "",
  copyFromId: ""
};

const nextSeasonDefaults = (seasons, teamName) => {
  const latest = (seasons || []).find((season) => /^\d{4}\/\d{4}$/.test(season.season_name || ""));
  const startYear = latest
    ? Number(latest.season_name.slice(0, 4)) + 1
    : new Date().getMonth() >= 5
      ? new Date().getFullYear() + 1
      : new Date().getFullYear();

  return {
    name: `${startYear}/${startYear + 1}`,
    displayName: latest?.display_name || teamName || "",
    startsOn: `${startYear}-06-01`,
    endsOn: `${startYear + 1}-05-31`,
    copyFromId: latest?.team_season_id || ""
  };
};

const formatSeasonDates = (season) => {
  if (season?.season_name === "Historik före säsongsindelning") return "Importerad historik";
  if (!season?.starts_on || !season?.ends_on) return "Datum saknas";
  return `${season.starts_on} – ${season.ends_on}`;
};

export default function SeasonPanel({
  open,
  team,
  selectedSeason,
  onSeasonChange,
  seasons = [],
  activeTeamSeason,
  roster = [],
  loading = false,
  error = "",
  onRefresh,
  onToast,
  onClose
}) {
  const [view, setView] = useState("overview");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [sourceRoster, setSourceRoster] = useState([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");

  const selectedSource = useMemo(
    () => seasons.find((season) => season.team_season_id === form.copyFromId) || null,
    [form.copyFromId, seasons]
  );
  const previousSeasons = seasons.filter((season) => season.team_season_id !== activeTeamSeason?.team_season_id);

  useEffect(() => {
    if (!open) return;
    setView("overview");
    setStep(1);
    setLocalError("");
  }, [open, team?.onlineId]);

  if (!open) return null;

  const startWizard = () => {
    setForm(nextSeasonDefaults(seasons, activeTeamSeason?.display_name || team?.name));
    setSourceRoster([]);
    setSelectedPlayerIds(new Set());
    setLocalError("");
    setStep(1);
    setView("wizard");
  };

  const loadSourceRoster = async () => {
    if (!form.copyFromId) {
      setSourceRoster([]);
      setSelectedPlayerIds(new Set());
      setStep(3);
      return;
    }

    setBusy(true);
    setLocalError("");
    const { data, error: rosterError } = await supabase.rpc("list_team_season_roster", {
      target_team_id: team.onlineId,
      target_team_season_id: form.copyFromId
    });
    setBusy(false);

    if (rosterError) {
      setLocalError(rosterError.message);
      return;
    }

    const includedPlayers = (data || []).filter((player) => player.included && player.active);
    setSourceRoster(includedPlayers);
    setSelectedPlayerIds(new Set(includedPlayers.map((player) => player.player_identity_id)));
    setStep(3);
  };

  const createSeason = async () => {
    if (!supabase || !team?.onlineId) return;
    setBusy(true);
    setLocalError("");

    const { data, error: createError } = await supabase.rpc("create_team_season", {
      target_team_id: team.onlineId,
      new_season_name: form.name.trim(),
      new_starts_on: form.startsOn,
      new_ends_on: form.endsOn,
      new_display_name: form.displayName.trim(),
      copy_from_team_season_id: form.copyFromId || null
    });

    if (createError) {
      setLocalError(createError.message);
      setBusy(false);
      return;
    }

    const createdSeason = (data || []).find((season) => season.season_name === form.name.trim());
    const excludedPlayers = sourceRoster.filter(
      (player) => !selectedPlayerIds.has(player.player_identity_id)
    );

    for (const player of excludedPlayers) {
      const { error: rosterError } = await supabase.rpc("set_team_season_roster_player", {
        target_team_id: team.onlineId,
        target_team_season_id: createdSeason?.team_season_id,
        target_player_identity_id: player.player_identity_id,
        new_shirt_number: player.shirt_number,
        new_player_role: player.player_role || "field",
        is_included: false
      });
      if (rosterError) {
        setLocalError(`Säsongen skapades, men truppen kunde inte färdigställas: ${rosterError.message}`);
        setBusy(false);
        onSeasonChange?.(form.name.trim());
        await onRefresh?.();
        setView("overview");
        return;
      }
    }

    onSeasonChange?.(form.name.trim());
    await onRefresh?.();
    setBusy(false);
    setView("overview");
    onToast?.("Den nya säsongen är klar");
  };

  const setCurrentRosterPlayer = async (player, included) => {
    if (!activeTeamSeason?.team_season_id) return;
    setBusy(true);
    setLocalError("");
    const { error: rosterError } = await supabase.rpc("set_team_season_roster_player", {
      target_team_id: team.onlineId,
      target_team_season_id: activeTeamSeason.team_season_id,
      target_player_identity_id: player.player_identity_id,
      new_shirt_number: player.shirt_number,
      new_player_role: player.player_role || "field",
      is_included: included
    });
    if (rosterError) {
      setLocalError(rosterError.message);
    } else {
      await onRefresh?.();
      onToast?.(included ? "Spelaren lades till i säsongen" : "Spelaren togs bort från säsongen");
    }
    setBusy(false);
  };

  const toggleWizardPlayer = (playerId) => {
    setSelectedPlayerIds((current) => {
      const next = new Set(current);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  };

  const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100";

  return (
    <div className="fixed inset-0 z-[80] overscroll-contain bg-slate-950/55 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Säsong">
      <div className="mx-auto flex h-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">{team?.name}</div>
            <h2 className="text-xl font-extrabold text-slate-900">Säsong</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Stäng
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4">
          {(error || localError) && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{localError || error}</div>
          )}

          {view === "overview" && (
            <>
              <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-sky-700">Vald säsong</div>
                {loading ? (
                  <div className="mt-2 text-sm text-slate-600">Hämtar säsongen...</div>
                ) : activeTeamSeason ? (
                  <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <div className="text-xl font-extrabold text-slate-900">{activeTeamSeason.display_name}</div>
                      <div className="text-sm font-semibold text-slate-700">{activeTeamSeason.season_name}</div>
                      <div className="mt-1 text-xs text-slate-500">{formatSeasonDates(activeTeamSeason)} · {activeTeamSeason.active_player_count} spelare</div>
                    </div>
                    <button type="button" onClick={() => setView("roster")} className="rounded-xl border border-sky-300 bg-white px-3 py-2 text-sm font-bold text-sky-800">
                      Hantera trupp
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-slate-600">Ingen databaskopplad säsong är vald.</div>
                )}
              </section>

              <button type="button" onClick={startWizard} className="mt-4 w-full rounded-2xl bg-sky-600 px-4 py-3 text-base font-extrabold text-white hover:bg-sky-700">
                Starta ny säsong
              </button>

              {previousSeasons.length > 0 && (
                <section className="mt-6">
                  <h3 className="text-base font-extrabold text-slate-900">Tidigare säsonger</h3>
                  <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                    {previousSeasons.map((season) => (
                      <button key={season.team_season_id} type="button" onClick={() => onSeasonChange?.(season.season_name)} className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-b-0 hover:bg-slate-50">
                        <span>
                          <span className="block font-bold text-slate-900">{season.display_name}</span>
                          <span className="block text-xs text-slate-500">{season.season_name} · {season.active_player_count} spelare</span>
                        </span>
                        <span className="text-sm font-semibold text-sky-700">Visa</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {view === "wizard" && (
            <>
              <div className="mb-5 flex items-center gap-2" aria-label={`Steg ${step} av 4`}>
                {[1, 2, 3, 4].map((item) => (
                  <span key={item} className={`h-2 flex-1 rounded-full ${item <= step ? "bg-sky-600" : "bg-slate-200"}`} />
                ))}
              </div>

              {step === 1 && (
                <section>
                  <h3 className="text-lg font-extrabold text-slate-900">1. Den nya säsongen</h3>
                  <p className="mt-1 text-sm text-slate-600">Förslagen går att ändra innan du fortsätter.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-semibold text-slate-700">Säsong
                      <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} className={inputClass} placeholder="2027/2028" />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">Lagets namn denna säsong
                      <input value={form.displayName} onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))} className={inputClass} />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">Startdatum
                      <input type="date" value={form.startsOn} onChange={(event) => setForm((prev) => ({ ...prev, startsOn: event.target.value }))} className={inputClass} />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">Slutdatum
                      <input type="date" value={form.endsOn} onChange={(event) => setForm((prev) => ({ ...prev, endsOn: event.target.value }))} className={inputClass} />
                    </label>
                  </div>
                </section>
              )}

              {step === 2 && (
                <section>
                  <h3 className="text-lg font-extrabold text-slate-900">2. Välj trupp att utgå från</h3>
                  <p className="mt-1 text-sm text-slate-600">Spelarna återanvänds med samma identitet och skapar därför inga dubletter.</p>
                  <div className="mt-4 space-y-2">
                    <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${!form.copyFromId ? "border-sky-400 bg-sky-50" : "border-slate-200"}`}>
                      <input type="radio" name="season-source" checked={!form.copyFromId} onChange={() => setForm((prev) => ({ ...prev, copyFromId: "" }))} />
                      <span><span className="block font-bold">Börja med tom trupp</span><span className="text-sm text-slate-500">Lägg till spelarna senare.</span></span>
                    </label>
                    {seasons.map((season) => (
                      <label key={season.team_season_id} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${form.copyFromId === season.team_season_id ? "border-sky-400 bg-sky-50" : "border-slate-200"}`}>
                        <input type="radio" name="season-source" checked={form.copyFromId === season.team_season_id} onChange={() => setForm((prev) => ({ ...prev, copyFromId: season.team_season_id }))} />
                        <span><span className="block font-bold">{season.display_name} – {season.season_name}</span><span className="text-sm text-slate-500">{season.active_player_count} aktiva spelare</span></span>
                      </label>
                    ))}
                  </div>
                </section>
              )}

              {step === 3 && (
                <section>
                  <h3 className="text-lg font-extrabold text-slate-900">3. Välj spelare</h3>
                  <p className="mt-1 text-sm text-slate-600">Avmarkera de spelare som inte ska följa med till den nya säsongen.</p>
                  {sourceRoster.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">Den nya säsongen börjar med tom trupp.</div>
                  ) : (
                    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                      {sourceRoster.map((player) => (
                        <label key={player.player_identity_id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0">
                          <input type="checkbox" checked={selectedPlayerIds.has(player.player_identity_id)} onChange={() => toggleWizardPlayer(player.player_identity_id)} className="h-4 w-4 rounded border-slate-300 text-sky-600" />
                          <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">{player.display_name}</span>
                          <span className="text-sm text-slate-500">#{player.shirt_number ?? "–"}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {step === 4 && (
                <section>
                  <h3 className="text-lg font-extrabold text-slate-900">4. Bekräfta</h3>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xl font-extrabold text-slate-900">{form.displayName}</div>
                    <div className="mt-1 font-semibold text-slate-700">{form.name}</div>
                    <div className="mt-1 text-sm text-slate-500">{form.startsOn} – {form.endsOn}</div>
                    <div className="mt-3 text-sm text-slate-700">{form.copyFromId ? `${selectedPlayerIds.size} spelare följer med från ${selectedSource?.display_name || "tidigare säsong"}.` : "Säsongen börjar med tom trupp."}</div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">Laget och matchhistoriken behålls. Endast en ny säsong och dess trupp skapas.</p>
                </section>
              )}

              <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-4">
                <button type="button" disabled={busy} onClick={() => step === 1 ? setView("overview") : setStep((current) => current - 1)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">
                  {step === 1 ? "Avbryt" : "Tillbaka"}
                </button>
                {step < 4 ? (
                  <button type="button" disabled={busy || (step === 1 && (!form.name.trim() || !form.displayName.trim() || !form.startsOn || !form.endsOn))} onClick={() => step === 2 ? loadSourceRoster() : setStep((current) => current + 1)} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                    {busy ? "Hämtar..." : "Fortsätt"}
                  </button>
                ) : (
                  <button type="button" disabled={busy} onClick={createSeason} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                    {busy ? "Skapar..." : "Skapa säsong"}
                  </button>
                )}
              </div>
            </>
          )}

          {view === "roster" && (
            <section>
              <button type="button" onClick={() => setView("overview")} className="mb-4 text-sm font-bold text-sky-700">← Tillbaka till säsongen</button>
              <h3 className="text-lg font-extrabold text-slate-900">Trupp för {activeTeamSeason?.display_name || selectedSeason}</h3>
              <p className="mt-1 text-sm text-slate-600">Markera vilka spelare som ska vara aktiva i den valda säsongen.</p>
              {loading ? (
                <div className="mt-4 text-sm text-slate-500">Hämtar truppen...</div>
              ) : roster.length === 0 ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">Det finns inga tidigare spelare att välja ännu.</div>
              ) : (
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                  {roster.map((player) => (
                    <label key={player.player_identity_id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0">
                      <input type="checkbox" checked={Boolean(player.included && player.active)} disabled={busy} onChange={(event) => setCurrentRosterPlayer(player, event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-sky-600" />
                      <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">{player.display_name}</span>
                      <span className="text-sm text-slate-500">#{player.shirt_number ?? "–"}</span>
                    </label>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
