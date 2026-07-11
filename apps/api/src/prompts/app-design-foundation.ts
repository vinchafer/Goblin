// A-2 (WAVE-A) — the design foundation for GENERATED apps.
//
// Founder verdict on first-generation agent output: "mittelmässig bis schlecht".
// This is a compact, opinionated style contract injected into AGENT-MODE generation so
// the very first thing the agent builds already looks composed — whitespace, hierarchy,
// a harmonious palette — instead of a default-browser wall of Times New Roman.
//
// SCOPE — read this twice: this shapes the HTML/CSS the agent WRITES FOR THE USER. It is
// NOT Goblin's own UI, and it is NOT a hard template — it is a floor. When the user asks
// for a specific look ("brutalist", "wie Notion", "meine Marke ist pink"), THAT wins; this
// only fills the vacuum when the user gave no design direction. No external CSS framework
// is pulled in by default (an unrequested Tailwind/Bootstrap CDN is bloat + a supply-chain
// surface); everything below is plain CSS the agent inlines.
//
// Budget: kept under ~1.5k tokens on purpose — it rides in the byte-stable static prefix
// (A-1), so it is cache-warm and costs ~0 marginal TTFT after the first turn. Ledger:
// A19-adjacent, ~+1.5k input tokens per agent-generation turn (cached after warm-up).

export const APP_DESIGN_FOUNDATION = `Design-Grundlage für alles, was du BAUST (gilt für die generierte App, NICHT für Goblin selbst):
Wenn der Nutzer KEINE eigene Gestaltung vorgibt, baue nach dieser Grundlage — sie ist der Mindeststandard, kein Korsett. Verlangt der Nutzer einen bestimmten Look oder eine Marke, hat sein Wunsch Vorrang. Keine externen CSS-Frameworks (kein Tailwind-/Bootstrap-CDN), sofern der Nutzer sie nicht ausdrücklich will — schreibe schlankes eigenes CSS.

- Grundgerüst: <!doctype html>, <html lang="…">, <meta charset="utf-8">, <meta name="viewport" content="width=device-width, initial-scale=1">. Mobile-first: zuerst fürs schmale Display bauen, dann per @media (min-width: 640px) verbreitern.
- Schrift: System-Stack als Basis — font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif. Höchstens EINE Google-Font, und nur für Überschriften (z. B. "Inter"/"Fraunces" via <link>); Fließtext bleibt im System-Stack. Nie mehr als zwei Schriftfamilien. Zeilenhöhe 1.5 für Text, 1.15 für Überschriften.
- Rhythmus: eine Spacing-Skala in 4-px-Schritten (4, 8, 12, 16, 24, 32, 48, 64) — nutze NUR diese Werte für margin/padding/gap, keine krummen Zahlen. Konsistenter Abstand schlägt Dekoration.
- Layout: zentrierter Inhalt mit max-width um 40rem für Text bzw. 64rem für App-Oberflächen, margin-inline: auto, seitliches padding von mind. 16px, damit auf dem Handy nichts klebt. Gib Elementen Luft.
- Farben: leite eine harmonische Palette aus EINER Grundfarbe ab — ein Akzent (Buttons/Links), dazu neutrale Grautöne für Text und Flächen. Guter Kontrast (Text auf Fläche mind. WCAG AA). Definiere alle Farben als CSS-Variablen in :root und liefere per @media (prefers-color-scheme: dark) eine dunkle Variante mit — dunkler Grund (nicht reines Schwarz, eher #14161a), heller Text, gleicht entsättigter Akzent. Nie heller Text auf hellem Grund.
- Buttons: klare Grundform — genug padding (z. B. 10px 16px), border-radius um 8–10px, kräftige Akzentfläche mit lesbarem Text, sichtbarer :hover- und :focus-visible-Zustand (Fokusring nie entfernen). Sekundäre Aktionen als ruhigerer Umriss.
- Eingabefelder: volle Breite im Formular, 1px ruhiger Rahmen, gleiches border-radius wie Buttons, deutlicher :focus-Zustand (Rahmen in Akzentfarbe), zugehöriges <label>. Touch-Ziele mind. 44px hoch.
- Feinschliff: dezente Übergänge (transition ~150ms) auf Hover/Focus statt harter Sprünge; sparsame box-shadow für Erhöhung; abgerundete Ecken konsistent halten. Weniger, aber sauber — kein Effekt-Wildwuchs.
Ziel: schon die erste Version wirkt aufgeräumt und absichtsvoll — klare Hierarchie, atmender Weißraum, stimmige Farben in hell UND dunkel.`;
