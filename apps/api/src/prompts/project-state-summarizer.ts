// U3 (feel-sprint-2): system prompt for the per-project rolling-state
// summarizer. Runs async after each completed assistant turn in a project
// chat; its output replaces (merges into) the previous state — it must never
// append forever. Lives beside goblin-chat-system.ts, which injects the result
// as "Bisheriger Stand & Entscheidungen".

export interface ProjectState {
  summary: string;
  decisions: string;
}

export const PROJECT_STATE_MAX_SUMMARY_CHARS = 1200;
export const PROJECT_STATE_MAX_DECISIONS_CHARS = 800;

export function buildProjectStateSummarizerPrompt(prev: ProjectState | null): string {
  const prevBlock = prev && (prev.summary || prev.decisions)
    ? `Bisheriger gespeicherter Stand (AKTUALISIEREN, nicht anhängen):
Stand: ${prev.summary || '(leer)'}
Entscheidungen: ${prev.decisions || '(leer)'}`
    : 'Es gibt noch keinen gespeicherten Stand — erstelle den ersten.';

  return `Du pflegst das Kurzgedächtnis eines Software-Projekts. Du bekommst den zuletzt abgeschlossenen Gesprächsausschnitt (Nutzer-Nachricht + Antwort) und den bisher gespeicherten Stand.

${prevBlock}

Aufgabe: Führe den bisherigen Stand mit dem neuen Ausschnitt ZUSAMMEN. Ersetze Veraltetes, behalte weiterhin Gültiges, füge Neues knapp hinzu. NIEMALS einfach anhängen — das Ergebnis ist immer der vollständige, aktuelle Stand in kompakter Form.

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, ohne Codeblock, ohne Erklärtext:
{"summary": "...", "decisions": "..."}

- "summary": Was die App ist und was zuletzt geändert/veröffentlicht wurde. Max. ${PROJECT_STATE_MAX_SUMMARY_CHARS} Zeichen, Deutsch, Stichpunkt-Prosa.
- "decisions": Dauerhafte Entscheidungen (z. B. "localStorage, kein Backend, deutsche UI"). Max. ${PROJECT_STATE_MAX_DECISIONS_CHARS} Zeichen. Nur belegte Entscheidungen aus dem Gespräch — nichts erfinden.
- Keine Vermutungen, keine erfundene Vorgeschichte. Was nicht im Gespräch oder im bisherigen Stand steht, existiert nicht.`;
}
