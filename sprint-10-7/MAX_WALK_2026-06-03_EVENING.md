# Max-Walk — 2026-06-03 Evening (Vincent, iPhone, his own account)

Verbatim feedback from Vincent's real Max-walk after Sprint 10.6 deploy.

## [ONBOARDING]
- Sprache jetzt eingebaut, ABER zu prominent mit Flaggen und großem Text. Wie auf einer
  Übersetzungswebsite. Einfach kurz EN / DE. App ist in beiden Sprachen gleich stark.
  Können nicht hinschreiben "app läuft nicht so gut".
- Step 3 ist Erklärung wie Goblin funktioniert (Layer-Story). Müsste eigentlich Step 2 sein,
  BEVOR User Modelle wählt. Macht so mehr Sinn.
- Step 3 noch nicht optimal formatiert, Claude Code muss nochmals investieren.
- Layer 3 ist nicht anklickbar — falls User Layer-3-Provider vorhin weggelassen hat, müsste
  er hier zurück können.
- Step 4 Toggles stimmen IMMER NOCH NICHT. Jetzt Quadrate. Vorher waren abgerundete Quadrate.
  Ich will RECHTECKE, WENIGER HOCH ALS BREIT, nur so hoch wie der Schiebebutton.
- Step 4 "Continue → Integrations" Button: text besser leserlich aber sieht wie markiert aus,
  nicht wie Button.
- Step 5 oben besser, weiter unten ändert Format und Style. Alles gleich wie oben bitte.
- Vercel-Erklärung sollte oberhalb Token-Eingabe stehen, nicht darunter — User soll Ownership
  lesen BEVOR er Token hinterlegt.

## [SAG GOBLIN MODAL]
- Modal mit 3 Fragen kommt sauber. Aber nach "Neues Projekt erstellen" landet User im
  Projekt-Dashboard, nicht im Chat. Wäre schöner: User landet direkt im Chat mit der Eingabe
  schon drin. So muss er nicht nochmal eingeben und nochmal auf "Chat öffnen" klicken.

## [CHAT / PROJECT CHAT]
- Im Chat falsches GoblinLogo. Jetzt überall mit grünem Hintergrund. Ich wollte das grüne
  ohne Hintergrund. Beim Laden.
- Im Projekt: "Chat öffnen" öffnet immer den GLEICHEN Chat. Auch unter "Chats" im Projekt
  steht nur "Chat öffnen", öffnet immer den gleichen. Theoretisch müsste oben "Neuer Chat"
  stehen, und bei "Chats" eine Auflistung vergangener Konversationen.
- Bei "Chats" in der Sidebar sieht man den Projekt-Chat nicht.
- Chat im Projekt und Chat ohne Projekt sehen ANDERS aus. Soll alles wie normaler Chat aussehen.
- Im normalen Chat stimmt das Loading-Logo. Im Projekt-Chat NICHT. Auch dort lädt Gemini nicht
  wirklich.

## [MODELS — HARD BUG]
- Groq Key konnte nicht hinzugefügt werden obwohl Key stimmt. Da ist ein Bug drin.
- Dann Gemini hinzugefügt. Chat erneut gesendet, weiterhin nicht möglich — steht einfach
  Goblin-Logo und "Gemini 2.5 Pro" ohne weiteres.
- In Einstellungen → Modelle: bei Klick auf "Groq hinzufügen" öffnen sich die ALTEN
  Einstellungen (vor Sprint 10.5), nicht die neuen.
- Vinc.hafner3 ist Claude Codes Test-Account. Vincent hat separaten Account. Auf Vincents
  Account haben Modelle heute morgen funktioniert. Nach 10.6-Deploy nicht mehr.

## [NICHT TESTBAR DURCH MODELL-BUG]
Konnte Vincent NICHT testen weil Modelle nicht laufen:
- Send All → separate Files
- Sichern
- Vercel-Token hinterlegen
- Veröffentlichen → 200 statt 404
- GitHub-Connect stays connected
→ durch 10.7-1/2/3 freizuschalten, nächste Walk-Runde prüfen.
