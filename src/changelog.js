// src/changelog.js

// ✅ Enkla "Vad är nytt?"-punkter per version (för modalen)
const WHATS_NEW_BY_VERSION = {
  "1.4.9.2": [
    "**Nyhet:** Säsongsvyn har fått nya filter så att du enklare kan växla mellan alla matcher, seriematcher, cuper eller en specifik cup.",
    "**Nyhet:** En ny översikt i Säsong lyfter fram bland annat bästa match, starkaste försvar, målfarligaste match och snittmål per match.",
    "**Nyhet:** Cupinformation visas tydligare i sparade matcher, så det blir lättare att skilja på serie och olika cuper.",
    "**Fix:** Säsongsstatistiken är mer träffsäker och räknar nu även bortamatcher korrekt.",
    "**Fix:** Straffmål och straffmissar räknas nu inte dubbelt.",
    "**Fix:** Flera sammanställningar i säsongsvyn har förbättrats för att ge en tydligare och mer rättvis bild av lagets matcher."
  ],
  "1.4.6": [
    "Cupnamn följer med i filnamn.",
    "Cupnamn visas i Excel-export."
  ],
  "1.4.7": [
    "Tydligare matchvy med totalsiffror.",
    "Straffmål räknas nu in i mål för utespelare.",
    "Straffmiss räknas nu in i utanför för utespelare.",
    "Straffräddningar och straffmål syns direkt i målvaktens räddning/insläppt.",
    "Ny ruta som visar vad som är nytt efter uppdatering."
  ],
  "1.4.8": [
    "Fix: Straffmål räknades dubbelt i måltavlan (målvakt).",
    "Fix: Excel-exporten räknar nu 7m korrekt för målvakter (inkl rädd%).",
    "Förbättring: “Mer”-menyn kan stängas med klick utanför, ESC och kryss.",
    "Förbättring: Nyhetsrutan kan stängas med X, klick utanför och ESC.",
    "Ändring: \"Tekniskt fel (lag)\" är borttaget."
  ]
};

// ✅ Tooltip-texten (oförändrat beteende)
export function getChangelogTooltip(version) {
  const items = WHATS_NEW_BY_VERSION[version] || [];
  const header = `${version} – Nytt:`;
  const lines = [header, ...items.map((t) => `• ${t}`)];
  return lines.join("\n");
}

// ✅ NY: används av “Vad är nytt?”-rutan (modalen)
export function getWhatsNewItems(version) {
  return WHATS_NEW_BY_VERSION[version] || [];
}
