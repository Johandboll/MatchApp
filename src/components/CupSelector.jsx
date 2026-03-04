// (Reservkomponent för ev. framtida utbrytning – används ej just nu)
// Om du vill använda separat komponent för Cup-läget, kan du importera denna.
import React from "react";

export default function CupSelector({ cupEnabled, setCupEnabled, cupName, setCupName }) {
  return (
    <div className="mb-4 p-3 border rounded-xl bg-white/60">
      <label className="flex items-center gap-2 mb-2">
        <input type="checkbox" checked={cupEnabled} onChange={(e) => setCupEnabled(e.target.checked)} />
        <span className="font-medium">Cup-läge</span>
      </label>
      <input
        type="text"
        placeholder="Cup/turneringens namn (valfritt)"
        className="border p-2 rounded w-full"
        value={cupName}
        onChange={(e) => setCupName(e.target.value)}
        disabled={!cupEnabled}
      />
    </div>
  );
}