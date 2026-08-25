import React, { useMemo, useState } from "react";
import Tooltip from "./Tooltip";

const monthNames = [
  "Januari",
  "Februari",
  "Mars",
  "April",
  "Maj",
  "Juni",
  "Juli",
  "Augusti",
  "September",
  "Oktober",
  "November",
  "December"
];

const weekdayNames = ["M", "T", "O", "T", "F", "L", "S"];

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sameDay(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function MatchSetup({
  teamName,
  matchInfo,
  onMatchInfoChange,
  playersForUI,
  selectedPlayers,
  onTogglePlayer,
  cupPanelOpen,
  setCupPanelOpen,
  setCupEnabled,
  cupName,
  setCupName,
  cupPhase,
  setCupPhase,
  onStartMatch,
  canStartMatch,
  appVersion,
  changelogTooltip,
  matchSeason,
  isPastSeason = false
}) {
  const selectedDate = parseDate(matchInfo.date);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate || new Date());

  const calendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const first = new Date(year, month, 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - mondayOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [visibleMonth]);

  const openCalendar = () => {
    setVisibleMonth(selectedDate || new Date());
    setCalendarOpen(true);
  };

  const changeDate = (date) => {
    setCalendarOpen(false);
    onMatchInfoChange({ target: { name: "date", value: formatDate(date) } });
  };

  const getPlayerId = (player) => player.id ?? player.nr;
  const getPlayerShirtNumber = (player) => player.shirtNumber ?? player.nr;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">MatchApp</div>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Ny match</h1>
        </div>
        {teamName && (
          <div className="min-w-0 text-right">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Aktivt lag
            </div>
            <div className="truncate text-2xl font-extrabold text-slate-900">{teamName}</div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-base font-bold text-slate-900">Matchinformation</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Datum</span>
            <div className="relative">
              <button
                type="button"
                onClick={openCalendar}
                className={`h-[46px] w-full rounded-xl border border-slate-300 bg-white px-3 text-left text-base ${
                  matchInfo.date ? "text-slate-900" : "text-slate-400"
                }`}
                aria-label="Välj datum"
              >
                {matchInfo.date || "Välj datum"}
              </button>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">
                ▾
              </span>

              {calendarOpen && (
                <div
                  className="absolute left-0 top-[54px] z-30 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleMonth(
                          new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1)
                        )
                      }
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      aria-label="Föregående månad"
                    >
                      ‹
                    </button>
                    <div className="text-center">
                      <div className="text-base font-extrabold text-slate-900">
                        {monthNames[visibleMonth.getMonth()]}
                      </div>
                      <div className="text-xs font-semibold text-slate-500">
                        {visibleMonth.getFullYear()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleMonth(
                          new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1)
                        )
                      }
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      aria-label="Nästa månad"
                    >
                      ›
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-slate-400">
                    {weekdayNames.map((day) => (
                      <div key={day} className="py-1">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-1">
                    {calendarDays.map((date) => {
                      const inMonth = date.getMonth() === visibleMonth.getMonth();
                      const selected = sameDay(date, selectedDate);
                      const today = sameDay(date, new Date());

                      return (
                        <button
                          key={formatDate(date)}
                          type="button"
                          onClick={() => changeDate(date)}
                          className={`h-10 rounded-xl text-sm font-bold ${
                            selected
                              ? "bg-sky-600 text-white"
                              : today
                                ? "border border-sky-200 bg-sky-50 text-sky-800"
                                : inMonth
                                  ? "text-slate-800 hover:bg-slate-100"
                                  : "text-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex justify-between gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setCalendarOpen(false)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Stäng
                    </button>
                    <button
                      type="button"
                      onClick={() => changeDate(new Date())}
                      className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800"
                    >
                      Idag
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Motståndare</span>
            <input
              type="text"
              name="opponent"
              placeholder="Motståndare"
              className="h-[46px] w-full rounded-xl border border-slate-300 px-3 text-base"
              onChange={onMatchInfoChange}
              value={matchInfo.opponent}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Plats</span>
            <div className="relative">
              <select
                name="location"
                className={`h-[46px] w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 pr-10 text-base ${
                  matchInfo.location ? "text-slate-900" : "text-slate-400"
                }`}
                onChange={onMatchInfoChange}
                value={matchInfo.location}
              >
                <option value="">Välj plats</option>
                <option value="Hemma">Hemma</option>
                <option value="Borta">Borta</option>
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">
                ▾
              </span>
            </div>
          </label>
        </div>
        {isPastSeason && matchSeason && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            Matchen sparas i en tidigare säsong: {matchSeason}.
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-base font-bold text-slate-900">Spelare</div>
            <div className="text-sm text-slate-500">{selectedPlayers.length} valda</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {playersForUI.map((player) => {
            const playerId = getPlayerId(player);
            const shirtNumber = getPlayerShirtNumber(player);
            const selected = selectedPlayers.includes(playerId);
            const isGoalkeeper = player.role === "goalkeeper";
            const baseClass =
              "min-h-[56px] rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors";

            return (
              <button
                key={playerId}
                className={`${baseClass} ${
                  selected
                    ? isGoalkeeper
                      ? "border-amber-600 bg-amber-300 text-slate-950"
                      : "border-sky-700 bg-sky-600 text-white"
                    : isGoalkeeper
                      ? "border-amber-300 bg-amber-50 text-slate-900 hover:bg-amber-100"
                      : "border-sky-200 bg-sky-50 text-slate-900 hover:bg-sky-100"
                }`}
                onClick={() => onTogglePlayer(playerId)}
              >
                <span className="block">#{shirtNumber}</span>
                <span className="block truncate">{player.name}</span>
                {isGoalkeeper && <span className="block text-xs font-bold opacity-70">Målvakt</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={cupPanelOpen}
            onChange={(e) => {
              const checked = e.target.checked;
              setCupPanelOpen(checked);
              setCupEnabled(checked);
              if (!checked) setCupPhase("");
            }}
            className="h-5 w-5"
          />
          <span className="font-semibold text-slate-800">Cup/turnering</span>
        </label>

        {cupPanelOpen && (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              type="text"
              placeholder="Cup/turneringens namn (valfritt)"
              className="h-[46px] w-full rounded-xl border border-slate-300 px-3 text-base"
              value={cupName}
              onChange={(e) => setCupName(e.target.value)}
            />
            <label className="relative block">
              <select
                value={cupPhase}
                onChange={(e) => setCupPhase(e.target.value)}
                className={`h-[46px] w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 pr-10 text-base ${
                  cupPhase ? "text-slate-900" : "text-slate-400"
                }`}
                aria-label="Cupfas"
              >
                <option value="">Cupfas (valfritt)</option>
                <option value="Grupp">Grupp</option>
                <option value="Åttondel">Åttondel</option>
                <option value="Kvart">Kvart</option>
                <option value="Semi">Semi</option>
                <option value="Final">Final</option>
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">
                ▾
              </span>
            </label>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={onStartMatch}
          disabled={!canStartMatch}
          className={`rounded-xl px-5 py-3 text-base font-extrabold text-white shadow-sm ${
            canStartMatch ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-400 cursor-not-allowed"
          }`}
        >
          Starta match
        </button>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <Tooltip content={changelogTooltip}>
            <span>Version: {appVersion}</span>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
