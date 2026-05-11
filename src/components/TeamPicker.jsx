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

export default function TeamPicker({ teams, appVersion, onSelectTeam, error, onTeamCreated }) {
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
        `Det finns redan ett lag som heter ${duplicateTeam.name}. Be en ägare eller admin i laget lägga till dig istället.`
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

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 bg-gradient-to-b from-sky-50 via-white to-emerald-50">
      <div className="w-full max-w-2xl">
        <div className="mb-5 text-center">
          <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-sky-100 text-sky-800 border border-sky-200">
            MatchApp
          </p>
          <h2 className="mt-3 text-3xl font-extrabold text-slate-900">Välj lag</h2>
          <p className="mt-1 text-sm text-slate-600">
            Fortsätt till matchläge genom att välja ett lag.
          </p>
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Kunde inte hämta lag: {error}
          </div>
        )}

        {!error && teams.length === 0 && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Din inloggning är inte kopplad till något lag ännu.
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

        {onTeamCreated && (
          <form
            onSubmit={createTeam}
            className="mt-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm"
          >
            <div className="mb-3">
              <div className="text-base font-bold text-slate-900">Skapa nytt lag</div>
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
