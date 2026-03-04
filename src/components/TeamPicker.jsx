import React from "react";

export default function TeamPicker({ teams, appVersion, onSelectTeam }) {
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

        <div className="mt-4 text-center text-xs text-slate-500">Version: {appVersion}</div>
      </div>
    </div>
  );
}
