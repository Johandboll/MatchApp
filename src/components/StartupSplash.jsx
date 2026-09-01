import React from "react";

export default function StartupSplash() {
  return (
    <div
      className="min-h-screen bg-gradient-to-b from-slate-50 to-sky-50 px-6"
      role="status"
      aria-label="MatchApp startar"
    >
      <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center pb-12">
        <img
          src={`${process.env.PUBLIC_URL || ""}/icons/icon-192.png`}
          alt="MatchApp"
          className="h-28 w-28 rounded-[1.65rem] shadow-lg shadow-slate-300/50"
        />
        <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.24em] text-sky-700">
          MatchApp
        </p>
        <div className="mt-5 h-1 w-36 overflow-hidden rounded-full bg-slate-200">
          <span className="matchapp-start-progress block h-full w-full origin-left rounded-full bg-sky-600" />
        </div>
      </div>
    </div>
  );
}
