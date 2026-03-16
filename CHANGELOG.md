# Matchapp – Changelog


*Ny säsongsöversikt, bättre cupstatistik och flera viktiga buggfixar.*

## [1.4.9.2]
### Nytt
- Filter i **Säsong** för att visa:
  - alla matcher
  - endast serie
  - alla cuper
  - en specifik cup
- Cupinformation visas tydligare i matchlistor och matchdetaljer.
- Ny översikt i **Säsong** med:
  - ⭐ Bästa match
  - 🧱 Starkaste försvar
  - 🚀 Mest mål i en match
  - Snitt mål per match

### Förbättrat
- Sparade matcher innehåller nu matchtyp, cupnamn och cupfas så att statistik kan delas upp per cup och serie.
- Spelarlistor sorteras nu konsekvent efter tröjnummer.
- Benämningen **Stolpe** har ändrats till **Ribba** i statistiken.

### Fixat
- Bortamatcher räknas nu korrekt i säsongsstatistiken.
- Dubbelräkning av straffmål/straffräddningar för målvakter är åtgärdad.
- Matchlistan i Säsong följer nu valt filter även när inga matcher finns i aktuell vy.

---

## [1.4.9]
### Added
- Utfällbar händelselogg under pågående match.
- Möjlighet att radera en enskild händelse ur loggen och räkna om statistiken direkt.
- Stöd för att läsa in externa lagfiler via URL-parameter.

### Changed
- Match kan nu bara startas när datum, motståndare och hemma/borta är ifyllt.
- Datumfältet har förbättrats för mobil och desktop.
- Ångra och registrering av händelser visar tydligare feedback i appen.

### Fixed
- Äldre historikposter kompletteras nu automatiskt med id och tid så att loggen fungerar stabilt.
- Nollställning av match går nu tillbaka korrekt till steg 1.

---

## [1.4.8]
### Fixed
- Straffmål räknades tidigare dubbelt i måltavlan för målvakt och är nu rättat.
- Excel-exporten räknar nu 7m korrekt för målvakter, inklusive räddningsprocent.

### Changed
- `Mer`-menyn kan nu stängas med klick utanför, `ESC` och stängknapp.
- Nyhetsrutan kan nu stängas med `X`, klick utanför och `ESC`.
- Händelsen `Tekniskt fel (lag)` har tagits bort.

---

## [1.4.7]
### Added
- Tydligare matchvy med totalsiffror.
- Ny ruta som visar vad som är nytt efter uppdatering.

### Fixed
- Straffmål räknas nu in i mål för utespelare.
- Straffmiss räknas nu in i utanför för utespelare.
- Straffräddningar och straffmål syns direkt i målvaktens räddning respektive insläppt.

---

## [1.4.6] – 2025-12-29
### Added
- Cupnamn följer med i **filnamn** vid Excel-export.
- Cupnamn följer med och visas korrekt i **Excel-arket**.

### Fixed
- Versionshantering för build och lokal test är nu stabil (visar rätt version).
- Lokal test av produktionsbuild fungerar utan blank sida.

### Technical
- Tydlig uppdelning mellan lokal build och produktionsbuild (`build:local` / `build:prod`).
- ESLint-varning för `useEffect` (persist) åtgärdad.

---

## [1.4.5] – 2025-09-10
### Added
- Skott% tillagd i Excel-exporten (samma formel som i Statistikvyn).

### Fixed
- Skott% fixad i Statistikvyn (inkl. räddad i nämnaren).
- Alla siffror i Excel centrerade.

---

## [1.4.4] – 2025-09-10
### Added
- Ny kolumn **”Insl. mål”** i statistikvyn och Excel-export.
- Cup-panel flyttad under spelarna (hopfällbar med checkbox).
- Färgkodning: gul för målvakter, blå för utespelare.
- Versionsnummer visas längst ned i appen.

---

## [Mall för framtida versioner]

### Added
- 

### Changed
- 

### Fixed
- 

### Technical
- 

### Planned
- 
