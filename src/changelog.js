// src/changelog.js

// ✅ Enkla "Vad är nytt?"-punkter per version (för modalen)
const WHATS_NEW_BY_VERSION = {
  "2.0.4": [
    "**Åtkomst:** Nya konton kan vänta på godkännande innan de får skapa lag.",
    "**Laggräns:** Godkända användare kan få en personlig gräns för hur många lag de får skapa.",
    "**Systemadmin:** En ny systemadminvy gör det möjligt att godkänna, blockera och justera laggränser. Väntande användare markeras med en röd räknare.",
    "**Registrering:** Nya användare anger klubb och roll/funktion så godkännandet blir tydligare.",
    "**Lag:** Lagval och skapa lag finns nu samlat i Lag, och Säsong kan växla mellan dina lag.",
    "**Match:** Matchtruppen kan justeras under pågående match. Spelare med registrerade händelser låses för borttagning.",
    "**Säkerhet:** Appen varnar om lagbyte skulle radera påbörjad matchsetup eller en pågående match.",
    "**Säkerhet:** Skapa lag kontrolleras även i Supabase, inte bara i appens knappar."
  ],
  "2.0.3": [
    "**Telefonvy:** Matchvyn har fått ett särskilt telefonläge med tydligare spelarval och stora händelseknappar.",
    "**Snabb registrering:** Spelarens händelsepanel öppnas när du väljer spelaren och stängs automatiskt efter registreringen.",
    "**Integritet:** Information om personuppgifter visas vid första besöket efter inloggning och finns även via Lagadmin.",
    "**Roller:** Ägare och admin har tydligare ansvar. Destruktiva åtgärder som att ta bort matcher, rensa säsong och ta bort medlemmar är ägarstyrda.",
    "**iPad:** Den befintliga matchvyn för iPad är oförändrad."
  ],
  "2.0.2": [
    "**Säsongscenter:** Översikt, spelare och matcher har fått ett renare utseende som är snabbare att använda på iPad.",
    "**Spelarstatistik:** Spelare kopplas säkrare till samma identitet även när namn eller tröjnummer har ändrats.",
    "**Matchstatistik:** Straffar, räddningar och insläppta mål räknas nu utan risk för dubbelräkning.",
    "**Matchvyn:** Resultattavla, statistikknappar och Mer-menyer har blivit tydligare och mer lättanvända.",
    "**Säsonger:** Framtida säsonger visas inte längre i förväg. En ny säsong blir tillgänglig den 1 juni."
  ],
  "2.0.1": [
    "**Spelare från matcher:** Lagadmin kan nu föreslå spelare som finns i importerade matcher men saknas i truppen, så du slipper lägga in dem manuellt.",
    "**Tröjnummer:** Samma tröjnummer kan nu användas av flera spelare i samma lag. Appen använder namn som identitet och nummer som visning.",
    "**Säsong:** Ny säsong startar nu 1 juni varje år. Standardsäsongen är 2026/2027 och säsong 2024/2025 visas inte längre.",
    "**Matchvyn:** Säsongsvalet är borttaget från matchvyn för att minska risken att matcher hamnar på fel säsong."
  ],
  "2.0.0": [
    "**Online och inloggning:** Du kan nu skapa konto och logga in i MatchApp. Matcher, spelare och säsongsstatistik kan sparas online så att samma lag kan användas från flera enheter.",
    "**Lag och medlemmar:** Varje lag har egna spelare, matcher och statistik. En användare kan vara kopplad till flera lag, och ägare/admin kan lägga till fler personer via Lagadmin.",
    "**Lagadmin:** Hantera lagets spelare och medlemmar direkt i appen. Du kan lägga till spelare, ändra nummer, ändra roll och inaktivera spelare som inte längre ska vara med i truppen.",
    "**Offline-stöd:** MatchApp fungerar bättre vid dålig täckning. Om du sparar en match offline försöker appen synka den automatiskt när uppkopplingen kommer tillbaka.",
    "**Säsongsläge:** Säsongsläget har blivit tydligare. Matcherna visar mer information direkt, och du kan fortfarande öppna varje match för full statistik. Det finns också bättre stöd för cup/turnering och cupfas.",
    "**Säkrare hantering:** Flera riskmoment har fått tydligare MatchApp-dialoger, till exempel när du avslutar en match utan att spara, byter lag eller tar bort matcher.",
    "**Ny matchvy:** Starten för ny match har fått vald spelarräknare, större datumväljare och mer enhetliga fält.",
    "**Bra att veta:** Om ett lag redan finns ska du inte skapa det igen. Be i stället en ägare eller admin i laget att lägga till dig, annars hamnar statistik i olika lag."
  ],
  "1.5.1": [
    "**Fix:** Säsongsstatistiken använder nu samma beräkningar som matchstatistiken för målvakter, utespelare, totaler och detaljvyer."
  ],
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
  const items = WHATS_NEW_BY_VERSION[version] || WHATS_NEW_BY_VERSION[String(version || "").split("-")[0]] || [];
  const header = `${version} – Nytt:`;
  const lines = [header, ...items.map((t) => `• ${t}`)];
  return lines.join("\n");
}

// ✅ NY: används av “Vad är nytt?”-rutan (modalen)
export function getWhatsNewItems(version) {
  return WHATS_NEW_BY_VERSION[version] || WHATS_NEW_BY_VERSION[String(version || "").split("-")[0]] || [];
}
