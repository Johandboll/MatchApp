// components/StatsView.jsx
import React, { useMemo } from "react";
import { buildMatchStatRow, playerMatchesRef } from "../lib/appHelpers";

export default function StatsView({ allPlayers, selectedPlayers, stats }) {
  const rows = useMemo(() => {
    const selected = new Set(selectedPlayers);
    const players = (allPlayers || []).filter((p) =>
      [...selected].some((ref) => playerMatchesRef(p, ref))
    );

    return players.map((p) => {
      const row = buildMatchStatRow(p, stats);
      const isGK = row.isGoalkeeper;

      return {
        id: row.id,
        nr: row.nr,
        nameDisplay: `${p.name}${isGK ? " (MV)" : ""}`,
        isGK,

        totalGoals: isGK ? "" : row.goals,
        goal: isGK ? "" : row.goal,
        totalConceded: isGK ? row.gkConceded : "",
        concededOpen: isGK ? row.goal : "",
        totalSaves: isGK ? row.gkSaves : "",
        save: row.save,
        miss: row.miss,
        post: row.post,
        assist: row.assist,
        turnover: row.turnover,

        sevenCon:  isGK ? row.sevenGoal : "",
        sevenSave: isGK ? row.sevenMiss : "",
        savePct:   row.savePct,
        shotPct: row.shotPct,

        sevenGoal: isGK ? "" : row.sevenGoal,
        sevenMiss: isGK ? "" : row.sevenMiss,

        gkScored: isGK ? row.gkScored : "",

        twoMin: row.twoMin,
        yellowCard: row.yellowCard,
        redCard: row.redCard,
      };
    });
  }, [allPlayers, selectedPlayers, stats]);

  const columns = [
    { key: "totalGoals",   label: "Totalt mål" },
    { key: "goal",         label: "Spelmål" },
    { key: "totalConceded", label: "Totalt insl" },
    { key: "concededOpen", label: "Insl. spel" },
    { key: "totalSaves",   label: "Totalt rädd" },
    { key: "save",         label: "Rädd spel" },
    { key: "savePct",      label: "Rädd%" },
    { key: "miss",         label: "Utanför" },
    { key: "post",         label: "Ribba" },
    { key: "assist",       label: "Assist" },
    { key: "turnover",     label: "Tekn. fel" },
    { key: "sevenCon",     label: "7m Insl" },
    { key: "sevenSave",    label: "7m Räddning" },
    { key: "shotPct",      label: "Skott%" },
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
        <table className="min-w-[1400px] w-full text-sm border-separate" style={{ borderSpacing: 0 }}>
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
                <tr key={r.id ?? r.nr} className={rowBg}>
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
