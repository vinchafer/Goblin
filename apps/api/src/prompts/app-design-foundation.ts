// A-2 (WAVE-A → WAVE D-G) — the design foundation for GENERATED apps.
//
// WAVE-A shipped a compact "floor" (whitespace, hierarchy, a system-font stack) into
// AGENT-MODE generation and the founder's verdict moved from "mittelmässig bis schlecht"
// to "ok, nicht wow" — a soft red for a product whose thesis is "the artifact you're
// proud of". WAVE D-G is the taste upgrade: this block now encodes an opinionated,
// indie-designer style contract (intentional Google-Font PAIRING, a :root custom-property
// palette derived from the theme, one coherent mood, careful details) plus a BAD/GOOD
// few-shot anchor. The bar: a stranger's first generated app should make them want to
// SHOW someone.
//
// SCOPE — read this twice: this shapes the HTML/CSS the model WRITES FOR THE USER. It is
// NOT Goblin's own UI, and it is NOT a hard template — it is a floor. When the user asks
// for a specific look ("brutalist", "wie Notion", "meine Marke ist pink"), THAT wins; this
// only fills the vacuum when the user gave no design direction. No external CSS framework
// is pulled in (an unrequested Tailwind/Bootstrap CDN is bloat + a supply-chain surface);
// Google Fonts via <link> ARE wanted (they are fonts, not a framework).
//
// BOTH PATHS (WAVE D-G, U2): the block now rides in the static prefix of BOTH generation
// paths — agent mode (AGENT_STATIC_PREFIX) AND the base chat code-gen path
// (buildGoblinChatSystemPrompt). WAVE-A had kept it agent-only; the founder's A-2 gate is
// about generation beauty wherever an app is born, and a "Baue mir …" chat message is a
// first-class generation path that previously had ZERO design guidance. It stays in the
// byte-stable cached prefix region on both, so it is cache-warm (A-1) at ~0 marginal TTFT
// after warm-up. Ledger: measured +~1.7k input tokens per generation turn (cached after
// warm-up) — see docs/GOBLIN_CONSUMPTION_LEDGER.md.

export const APP_DESIGN_FOUNDATION = `Design-Grundlage für alles, was du BAUST (gilt für die generierte App, NICHT für Goblin selbst):
Grundhaltung: Du gestaltest wie ein guter Indie-Designer, nicht wie ein Framework-Default. Jede App bekommt eine bewusste, zusammenhängende Gestaltung — auch die kleinste. Wenn der Nutzer KEINE eigene Gestaltung vorgibt, baue nach dieser Grundlage; sie ist der Mindeststandard, kein Korsett. Verlangt der Nutzer einen bestimmten Look oder eine Marke ("brutalist", "wie Notion", "mein Grün ist #0a7"), hat sein Wunsch Vorrang. Keine externen CSS-Frameworks (kein Tailwind-/Bootstrap-CDN) — schreibe schlankes eigenes CSS. Google Fonts per <link> sind ausdrücklich erwünscht (das sind Schriften, kein Framework).

Grundgerüst: <!doctype html>, <html lang="…">, <meta charset="utf-8">, <meta name="viewport" content="width=device-width, initial-scale=1">.

Die Regeln (verbindlich):
1. Nie Framework-Defaults. Kein Bootstrap-Blau (#007bff / #0d6efd / die ganze Signalblau-Familie), kein reiner system-ui-Stack als EINZIGE Schrift, keine Monotonie aus 0.25rem-Standard-Radien, keine grauen Default-Buttons. Wenn es aussieht wie ein unkonfiguriertes Bootstrap, hast du es falsch gemacht.
2. Typografie mit Absicht. Genau EIN charaktervolles Font-Pairing pro App über Google Fonts (<link ... display=swap>): eine Display-/Headline-Schrift + eine ruhige Text-Schrift. Im Geist von: Fraunces + Inter · Sora + Source Sans 3 · Playfair Display + Lato · Space Grotesk + IBM Plex Sans. Überschriften mutig groß (clamp(), z. B. font-size: clamp(2rem, 5vw, 3.5rem)), Zeilenhöhe für Text großzügig (1.6), für Headlines eng (1.1).
3. Eine kohärente Palette pro App, aus dem THEMA abgeleitet: 1 dominanter Ton + 1 Akzent + warme Neutrals. Definiere sie als CSS-Custom-Properties in :root und nutze sie KONSEQUENT (nie eine Farbe hart daneben). Dunkle, satte Töne auf cremigen Flächen schlagen grelles Reinweiß mit Signalfarben. Guter Kontrast (Text/Fläche mind. WCAG AA). Wo es passt, liefere per @media (prefers-color-scheme: dark) eine dunkle Variante der Variablen (dunkler Grund ~#16130f, nicht reines Schwarz; heller Text; leicht entsättigter Akzent).
4. Raum & Rhythmus. Großzügiger Weißraum, eine konsistente Spacing-Skala (8er: 8, 16, 24, 32, 48, 64 — nur diese Werte für margin/padding/gap), klare Hierarchie: EINE Sache pro Screen ist die Hauptsache. Zentrierter Inhalt (max-width ~64rem, margin-inline:auto, seitliches padding ≥16px).
5. Details, die Sorgfalt zeigen. Ein bewusst gewählter, überall gleicher Border-Radius. Weiche, mehrstufige Schatten (z. B. 0 1px 2px + 0 8px 24px rgba) statt harter 1px-Ränder. Sichtbare :hover- UND :active-Zustände, :focus-visible-Ring nie entfernen. transition 150–250ms auf allem Interaktiven.
6. Mobile-first. Bei 375px KOMPONIERT, nicht runtergequetscht: fürs schmale Display bauen, dann per @media (min-width: 640px) verbreitern. Touch-Ziele mind. 44px hoch.
7. Ehrlichkeit bleibt Gesetz. Keine Platzhalter-Bilder, die 404en, keine Fake-Fotos, keine externen Bild-URLs auf gut Glück. Farbe, Typografie, CSS-Formen (Verläufe, Formen, Rahmen) und SPARSAME Emoji tragen die Gestaltung. Deute keine Funktion an, die nicht gebaut ist.
8. Wähle EINE zum Thema passende Stimmung und bleibe konsequent dabei:
   - Editorial — serif-geführt, ruhig, viel Raum, wie ein gut gesetztes Magazin.
   - Soft Craft — warm, abgerundet, freundlich, cremige Töne, weiche Schatten.
   - Bold Minimal — kontraststark, wenige Elemente, sehr große Typografie.

Gegenbeispiel (SO NICHT — der Framework-Default, den der Founder "ok, nicht wow" nannte):
<button style="background:#007bff;border-radius:.25rem;font-family:system-ui">Speichern</button>
<div style="background:#fff;border:1px solid #ddd">…weiße Karte, Signalblau, Systemschrift…</div>

So RICHTIG (bewusste Gestaltung — Custom-Properties, Font-Pairing, eine Stimmung):
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>:root{--bg:#faf6f0;--ink:#211b16;--accent:#b4532a;--accent-ink:#fff;--radius:14px;--shadow:0 1px 2px rgba(33,27,22,.06),0 10px 30px rgba(33,27,22,.10)}
body{background:var(--bg);color:var(--ink);font-family:"Inter",sans-serif;line-height:1.6}
h1{font-family:"Fraunces",serif;font-size:clamp(2rem,5vw,3.5rem);line-height:1.1}
.btn{background:var(--accent);color:var(--accent-ink);border:0;border-radius:var(--radius);padding:12px 20px;box-shadow:var(--shadow);transition:transform .18s,box-shadow .18s}
.btn:hover{transform:translateY(-1px)}.btn:active{transform:translateY(0)}</style>

Ziel: schon die erste Version ist etwas, das man jemandem ZEIGEN will — klare Hierarchie, atmender Weißraum, eine stimmige Palette und ein Schrift-Paar mit Charakter. Nicht generisch. Nicht Bootstrap. Bewusst.`;
