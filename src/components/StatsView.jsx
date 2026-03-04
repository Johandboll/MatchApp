// components/StatsView.jsx
import React, { useMemo } from "react";

function pct(n, d) {
  if (!d) return "";
  const v = (n / d) * 100;
  return `${Number.isFinite(v) ? v.toFixed(1) : "0.0"}%`;
}

export default function StatsView({ allPlayers, selectedPlayers, stats }) {
  const rows = useMemo(() => {
    const selected = new Set(selectedPlayers);
    const players = (allPlayers || []).filter(p => selected.has(p.nr));

    return players.map((p) => {
      const s = stats?.[p.nr] || {};
      const isGK = p.role === "goalkeeper";

      // För Rädd% (MV)
      const saves = (s.save || 0) + (s.sevenMiss || 0);
      const concededOpen = (s.goal || 0);
      const conceded7m   = (s.sevenGoal || 0);
      const shotsFaced   = saves + concededOpen + conceded7m;

      // --- Skott% (utespelare) ---
      const savedShot = Number(s.savedShot ?? s.saved ?? s.save ?? s.blockedShot ?? s.blocked ?? 0);
      const attempts = isGK ? 0 : Number((s.goal||0) + (s.sevenGoal||0) + (s.miss||0) + (s.post||0) + (s.sevenMiss||0) + savedShot);
      const made     = isGK ? 0 : Number((s.goal||0) + (s.sevenGoal||0));
      const shotPct  = isGK ? "" : pct(made, attempts);
      // ---------------------------

      return {
        nr: p.nr,
        nameDisplay: `${p.name}${isGK ? " (MV)" : ""}`,
        isGK,

        goal: isGK ? "" : (s.goal || 0),
        concededOpen: isGK ? concededOpen : "",
        save: s.save || 0,
        miss: s.miss || 0,
        post: s.post || 0,
        assist: s.assist || 0,
        turnover: s.turnover || 0,

        sevenCon:  isGK ? conceded7m : "",
        sevenSave: isGK ? (s.sevenMiss || 0) : "",
        savePct:   isGK ? pct(saves, shotsFaced) : "",
        shotPct, // ENDAT tillagt fält

        sevenGoal: isGK ? "" : (s.sevenGoal || 0),
        sevenMiss: isGK ? "" : (s.sevenMiss || 0),

        gkScored: isGK ? (s.gkScored || 0) : "",

        twoMin: s.twoMin || 0,
        yellowCard: s.yellowCard || 0,
        redCard: s.redCard || 0,
      };
    });
  }, [allPlayers, selectedPlayers, stats]);

  const columns = [
    { key: "goal",         label: "Mål" },
    { key: "concededOpen", label: "Insl. mål" },
    { key: "save",         label: "Räddning" },
    { key: "miss",         label: "Utanför" },
    { key: "post",         label: "Ribba" },
    { key: "assist",       label: "Assist" },
    { key: "turnover",     label: "Tekn. fel" },
    { key: "sevenCon",     label: "7m Insl" },
    { key: "sevenSave",    label: "7m Räddning" },
    { key: "savePct",      label: "Rädd%" },
    { key: "shotPct",      label: "Skott%" }, // infogad direkt efter Rädd%
    { key: "sevenGoal",    label: "7m Mål" },
    { key: "sevenMiss",    label: "7m Miss" },
    { key: "gkScored",     label: "MV mål" },
    { key: "twoMin",       label: "2 min" },
    { key: "yellowCard",   label: "Gult" },
    { key: "redCard",      label: "Rött" },
  ];

  return (
    <div className="border rounded-2xl shadow-sm overflow-hidden bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-[1250px] w-full text-sm border-separate" style={{ borderSpacing: 0 }}>
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-1.5 text-left border-b">Nr</th>
              <th className="px-3 py-1.5 text-left border-b">Namn</th>
              {columns.map(col => (
                <th
                  key={col.key}
                  className="px-3 py-1.5 text-center border-b whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rowBg = r.isGK ? "bg-yellow-50" : "bg-blue-50";
              return (
                <tr key={r.nr} className={rowBg}>
                  <td className="px-3 py-1.5 border-b font-semibold text-left">{r.nr}</td>
                  <td className="px-3 py-1.5 border-b text-left whitespace-nowrap overflow-hidden text-ellipsis w-[260px]">
                    {r.nameDisplay}
                  </td>
                  {columns.map(c => (
                    <td
                      key={c.key}
                      className="px-3 py-1.5 border-b text-center tabular-nums"
                    >
                      {r[c.key] === "" ? "" : r[c.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}