import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

const normalizeTeamName = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function TeamPicker({
  teams,
  appVersion,
  onSelectTeam,
  error,
  onTeamCreated,
  accountAccess,
  pendingAccountCount = 0,
  onOpenSystemAdmin,
  onSignOut
}) {
  const [teamName, setTeamName] = useState("");
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState("");

  const createTeam = async (event) => {
    event.preventDefault();
    const cleanTeamName = teamName.trim();
    if (!cleanTeamName || !supabase) return;

    const wantedSlug = normalizeTeamName(cleanTeamName);
    const duplicateTeam = teams.find((team) => normalizeTeamName(team.name || team.id) === wantedSlug);

    if (duplicateTeam) {
      setCreateError(
        `Det finns redan ett lag som heter ${duplicateTeam.name}. Be lagägaren eller en lagadmin lägga till dig istället.`
      );
      return;
    }

    setBusy(true);
    setCreateError("");

    const { data, error: rpcError } = await supabase.rpc("create_team_for_current_user", {
      team_name: cleanTeamName
    });

    if (rpcError) {
      setCreateError(rpcError.message);
      setBusy(false);
      return;
    }

    const createdTeam = Array.isArray(data) ? data[0] : data;
    setTeamName("");
    setBusy(false);
    onTeamCreated?.(createdTeam);
  };

  const hasCreateAccess = Boolean(onTeamCreated && accountAccess?.canCreateTeam);
  const isPending = accountAccess?.accountStatus === "pending";
  const isBlocked = accountAccess?.accountStatus === "blocked";
  const createdTeamCount = Number(accountAccess?.createdTeamCount || 0);
  const teamCreateLimit = Number(accountAccess?.teamCreateLimit || 0);
  const hasTeams = teams.length > 0;
  const title = hasTeams
    ? "Välj lag"
    : isPending
      ? "Kontot väntar på godkännande"
      : hasCreateAccess
        ? "Skapa ditt första lag"
        : "Inget lag kopplat";
  const subtitle = hasTeams
    ? "Fortsätt till matchläge genom att välja ett lag."
    : isPending
      ? "När kontot är godkänt kan du skapa lag eller bli tillagd i ett lag."
      : hasCreateAccess
        ? "Du kan skapa ett lag här och börja lägga in spelare."
        : "Be lagägaren eller en lagadmin lägga till dig i rätt lag.";

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 bg-gradient-to-b from-sky-50 via-white to-emerald-50">
      <div className="w-full max-w-2xl">
        <div className="mb-5 text-center">
          <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-sky-100 text-sky-800 border border-sky-200">
            MatchApp
          </p>
          <h2 className="mt-3 text-3xl font-extrabold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {subtitle}
          </p>
          {(onOpenSystemAdmin || onSignOut) && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {onOpenSystemAdmin && (
                <button
                  type="button"
                  onClick={onOpenSystemAdmin}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <span>Systemadmin</span>
                    {pendingAccountCount > 0 && (
                      <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-white">
                        {pendingAccountCount > 99 ? "99+" : pendingAccountCount}
                      </span>
                    )}
                  </span>
                </button>
              )}
              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                >
                  Logga ut
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Kunde inte hämta lag: {error}
          </div>
        )}

        {!error && teams.length === 0 && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {isBlocked
              ? "Kontot är blockerat och kan inte använda MatchApp."
              : isPending
                ? "Kontot väntar på godkännande innan du kan skapa lag."
                : hasCreateAccess
                  ? "Du har inget lag ännu. Skapa ditt första testlag nedan."
                  : "Din inloggning är inte kopplad till något lag ännu."}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {teams.map((team) => {
            const count = Array.isArray(team.players) ? team.players.length : 0;
            return (
              <button
                key={team.id}
                onClick={() => onSelectTeam(team.id)}
                className="group text-left p-4 rounded-2xl border border-slate-200 bg-white/90 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold text-slate-900">{team.name}</div>
                    <div className="mt-1 text-xs text-slate-500">Lagkod: {team.id}</div>
                  </div>
                  <span className="shrink-0 inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {count} spelare
                  </span>
                </div>
                <div className="mt-3 text-sm font-medium text-sky-700 group-hover:text-sky-800">
                  Välj lag
                </div>
              </button>
            );
          })}
        </div>

        {onTeamCreated && !hasCreateAccess && !isBlocked && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white/90 p-4 text-sm text-slate-600 shadow-sm">
            <div className="font-bold text-slate-900">Skapa nytt lag</div>
            <div className="mt-1">
              {isPending
                ? "När kontot är godkänt kan du skapa lag."
                : `Du har skapat ${createdTeamCount} av ${teamCreateLimit} tillåtna lag.`}
            </div>
          </div>
        )}

        {hasCreateAccess && (
          <form
            onSubmit={createTeam}
            className="mt-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm"
          >
            <div className="mb-3">
              <div className="text-base font-bold text-slate-900">Skapa nytt lag</div>
              <div className="mt-1 text-sm text-slate-500">
                Du har skapat {createdTeamCount} av {teamCreateLimit} tillåtna lag.
              </div>
            </div>
            {createError && (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createError}
              </div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
              <input
                type="text"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                placeholder="Lagnamn"
                className="rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                required
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Skapar..." : "Skapa lag"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-4 text-center text-xs text-slate-500">Version: {appVersion}</div>
      </div>
    </div>
  );
}
