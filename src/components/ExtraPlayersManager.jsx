// (Reservkomponent för ev. framtida utbrytning – används ej just nu)
// Denna komponent kan ersätta panelen i App.js om du vill renodla App.js.
import React from "react";

export default function ExtraPlayersManager({ extraPlayers, addExtraPlayer, removeExtraPlayer, clearExtraPlayers }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-2">Egna spelare för denna cup/match</h2>
      <div className="flex flex-wrap gap-2 mb-3">
        {extraPlayers.length === 0 && <div className="text-sm text-gray-500">Inga extra spelare tillagda ännu.</div>}
        {extraPlayers.map(p => (
          <span key={p.nr} className="inline-flex items-center gap-2 px-2 py-1 border rounded-lg bg-white">
            #{p.nr} {p.name}{p.role === "goalkeeper" ? " (MV)" : ""}
            <button className="text-red-600 font-bold" onClick={() => removeExtraPlayer(p.nr)} title="Ta bort">×</button>
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input id="xp-nr" type="number" inputMode="numeric" placeholder="Nummer" className="border p-2 rounded" />
        <input id="xp-name" type="text" placeholder="Namn" className="border p-2 rounded sm:col-span-2" />
        <select id="xp-role" className="border p-2 rounded">
          <option value="">Utespelare</option>
          <option value="goalkeeper">Målvakt</option>
        </select>
        <button
  className="sm:col-span-4 mt-1 bg-blue-600 text-white px-3 py-2 rounded-xl"
  onClick={() => {
    const nrInput = document.getElementById("xp-nr");
    const nameInput = document.getElementById("xp-name");
    const roleInput = document.getElementById("xp-role");

    const nr = nrInput.value;
    const name = nameInput.value;
    const role = roleInput.value;

    // Förhindra dubbletter
    if (extraPlayers.some(p => p.nr === nr)) {
      alert(`Nummer ${nr} finns redan i listan.`);
      return;
    }

    addExtraPlayer({ nr, name, role });

    // Töm fälten efter att spelaren lagts till
    nrInput.value = "";
    nameInput.value = "";
    roleInput.value = "";
  }}
>
  Lägg till extra spelare
</button>

<button
  className="sm:col-span-4 bg-gray-200 text-gray-700 px-3 py-2 rounded-lg"
  onClick={clearExtraPlayers}
>
  Rensa alla extra spelare
</button>

      </div>
    </div>
  );
}