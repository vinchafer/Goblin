// FEEL-3c C3 — loading quotes.
//
// During an agent run or a build, the step stream's idle gaps (>4s without a new real
// step) rotate one of these below the live step — clearly SECONDARY, never a fake step.
// Steps are truth; quotes are decoration. Curated, short, bilingual (DE/EN), about
// craft, building, and technology. Founder-editable: change this array, redeploy the
// web app — no migration, no content service (there is no CMS mechanism; a static
// module is the established pattern, see lib/greeting.ts). Keep them short (one line on
// a phone), specific, never cutesy, never a hollow motivational poster.

export interface LoadingQuote {
  de: string;
  en: string;
}

export const LOADING_QUOTES: LoadingQuote[] = [
  { de: "Gut gebaut ist besser als schnell versprochen.", en: "Well built beats quickly promised." },
  { de: "Jede Zeile Code ist eine Entscheidung.", en: "Every line of code is a decision." },
  { de: "Das Einfache ist das Schwerste — und das Beste.", en: "The simple thing is the hardest — and the best." },
  { de: "Ein Werkzeug soll verschwinden, während man es benutzt.", en: "A tool should disappear while you use it." },
  { de: "Software ist Handwerk, das man nicht anfassen kann.", en: "Software is craft you can't touch." },
  { de: "Erst verstehen, dann bauen.", en: "Understand first, then build." },
  { de: "Das Ehrliche ist auch das Wartbare.", en: "The honest thing is also the maintainable thing." },
  { de: "Details sind nicht Details — sie sind das Ganze.", en: "Details aren't details — they make the thing." },
  { de: "Kleine Schritte, echte Schritte.", en: "Small steps, real steps." },
  { de: "Ein guter Entwurf verzeiht spätere Fehler.", en: "A good design forgives later mistakes." },
  { de: "Man baut nicht für heute, man baut für den, der es morgen liest.", en: "You don't build for today — you build for whoever reads it tomorrow." },
  { de: "Lesbarkeit schlägt Klugheit.", en: "Readability beats cleverness." },
  { de: "Löschen ist auch Fortschritt.", en: "Deleting is progress too." },
  { de: "Das Beste an einer Sache ist oft das, was man weggelassen hat.", en: "The best part is often what you left out." },
  { de: "Geduld ist ein Teil der Technik.", en: "Patience is part of the engineering." },
  { de: "Ein Prototyp ist eine Frage, kein Versprechen.", en: "A prototype is a question, not a promise." },
  { de: "Wer misst, weiß mehr als wer meint.", en: "Whoever measures knows more than whoever guesses." },
  { de: "Zuerst richtig, dann schnell.", en: "First correct, then fast." },
  { de: "Struktur ist Freundlichkeit gegenüber dem nächsten Menschen.", en: "Structure is kindness to the next person." },
  { de: "Namen sind die halbe Miete.", en: "Good names are half the work." },
  { de: "Ein Fehler, den man versteht, ist schon fast gelöst.", en: "A bug you understand is almost fixed." },
  { de: "Das System soll den Menschen tragen, nicht umgekehrt.", en: "The system should carry the person, not the other way round." },
  { de: "Klarheit entsteht durch Wegnehmen.", en: "Clarity comes from taking away." },
  { de: "Was du nicht testest, hoffst du nur.", en: "What you don't test, you only hope for." },
  { de: "Handwerk ist die Summe vieler kleiner Sorgfalt.", en: "Craft is the sum of many small cares." },
  { de: "Eine Sache, die gut funktioniert, sieht mühelos aus.", en: "A thing that works well looks effortless." },
  { de: "Der Code von morgen liest sich heute.", en: "Tomorrow's code is written today." },
  { de: "Vertrauen baut man Zeile für Zeile.", en: "Trust is built line by line." },
  { de: "Erst den Weg sehen, dann gehen.", en: "See the path, then walk it." },
  { de: "Weniger, aber zu Ende gedacht.", en: "Less, but thought through to the end." },
  { de: "Ein ehrliches „noch nicht“ ist besser als ein falsches „fertig“.", en: "An honest “not yet” beats a false “done”." },
  { de: "Werkzeuge werden gut, wenn man sie täglich benutzt.", en: "Tools get good when you use them daily." },
  { de: "Die beste Abkürzung ist der gerade Weg.", en: "The best shortcut is the straight path." },
  { de: "Ordnung im Code ist Ruhe im Kopf.", en: "Order in the code is calm in the mind." },
  { de: "Bauen heißt entscheiden, was wichtig ist.", en: "Building means deciding what matters." },
  { de: "Ein Detail richtig gemacht trägt das Ganze.", en: "One detail done right carries the whole." },
  { de: "Geschwindigkeit kommt aus Klarheit, nicht aus Eile.", en: "Speed comes from clarity, not from hurry." },
  { de: "Das Gute wiederholt sich, das Schlechte auch — wähle bewusst.", en: "The good repeats, so does the bad — choose on purpose." },
  { de: "Man erkennt Qualität daran, dass niemand über sie spricht.", en: "You know quality because nobody has to talk about it." },
  { de: "Fertig ist nicht, wenn nichts mehr geht, sondern wenn nichts mehr fehlt.", en: "Done isn't when nothing works anymore — it's when nothing's missing." },
];

/** Deterministic-free pick used only in the browser (idle-gap decoration). */
export function pickQuote(index: number): LoadingQuote {
  const i = ((index % LOADING_QUOTES.length) + LOADING_QUOTES.length) % LOADING_QUOTES.length;
  return LOADING_QUOTES[i]!;
}
