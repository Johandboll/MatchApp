import React from "react";

export default function AppUpdatePrompt({ visible, onReload, reloading }) {
  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[90] sm:left-auto sm:right-4 sm:w-[360px]">
      <div className="rounded-2xl border border-sky-200 bg-white p-3 shadow-2xl">
        <div className="text-sm font-extrabold text-slate-900">Ny version finns tillgänglig</div>
        <div className="mt-1 text-xs text-slate-600">
          Ladda om appen för att använda den senaste versionen.
        </div>
        <button
          type="button"
          onClick={onReload}
          disabled={reloading}
          className="mt-3 w-full rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {reloading ? "Laddar om..." : "Ladda om appen"}
        </button>
      </div>
    </div>
  );
}
