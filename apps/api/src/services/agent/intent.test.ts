// FEEL-3b B2 gate: the intent matrix (D1). Explicit action phrases grant publish;
// absent OR ambiguous signals do NOT (→ draft + confirmation chip, never a guess).
// Two phrasings per class, DE + EN, case/Umlaut/diacritic-robust.

import { describe, it, expect } from 'vitest';
import { classifyPublishIntent, classifyRunIntent, hasBuildIntent, shouldRouteToAgent, hasRestoreIntent, grantsRestore } from './intent';

describe('publish intent — D1 matrix', () => {
  it('EXPLICIT (DE): a clear "live/veröffentlichen" request grants publish', () => {
    expect(classifyPublishIntent('Baue eine Mini-Umfrage-Seite und stell sie live.')).toBe('explicit');
    expect(classifyPublishIntent('Füge Dark-Mode hinzu und sag mir wenn es live ist.')).toBe('explicit');
    expect(classifyPublishIntent('Veröffentliche das jetzt bitte.')).toBe('explicit');
    expect(classifyPublishIntent('Kannst du die Seite online stellen?')).toBe('explicit');
  });

  it('EXPLICIT (EN): go live / ship it / publish grant publish', () => {
    expect(classifyPublishIntent('Build the page and make it live.')).toBe('explicit');
    expect(classifyPublishIntent('Add a settings page and tell me when it\'s live.')).toBe('explicit');
    expect(classifyPublishIntent('ship it')).toBe('explicit');
    expect(classifyPublishIntent('publish the site')).toBe('explicit');
  });

  it('ABSENT: pure build/edit requests do NOT grant publish', () => {
    expect(classifyPublishIntent('Baue eine kleine Zähler-App.')).toBe('none');
    expect(classifyPublishIntent('Ändere die Frage auf "Kaffee oder Tee?"')).toBe('none');
  });

  it('AMBIGUOUS: weak "live"/"online" mentions do NOT grant (→ chip, never guess)', () => {
    expect(classifyPublishIntent('Sieht die Live-Vorschau gut aus?')).toBe('none');
    expect(classifyPublishIntent('Kannst du mir das Ergebnis online zeigen?')).toBe('none');
    expect(classifyPublishIntent('Ist die Seite eigentlich schon online?')).toBe('none');
  });

  it('robust to casing, Umlaut spelling, and curly apostrophes', () => {
    expect(classifyPublishIntent('STELL ES LIVE')).toBe('explicit');
    expect(classifyPublishIntent('veroeffentliche es')).toBe('explicit'); // ö written as oe
    expect(classifyPublishIntent('tell me when it’s live')).toBe('explicit'); // curly apostrophe
  });
});

// ─── FW4 U1 (F-11): publish/build-intent ROUTING — the W10 gate ──────────────────
describe('run intent — routing to the agent (D1, the W10 gate)', () => {
  // The founder's verbatim W10 walk prompt. This is THE regression that must route.
  const WALK_PROMPT = 'Baue mir einen kleinen Habit-Tracker mit Datum und Häkchen. Und stell ihn live.';

  it('ROUTES: the verbatim walk prompt engages an agent run', () => {
    expect(classifyRunIntent(WALK_PROMPT)).toBe('agent');
    expect(shouldRouteToAgent(WALK_PROMPT)).toBe(true);
  });

  it('ROUTES: a pure publish intent (no build verb) routes', () => {
    // Publish-only follow-up on an existing project.
    expect(classifyRunIntent('Stell die Seite jetzt live.')).toBe('agent');
    expect(classifyRunIntent('publish it')).toBe('agent');
    expect(classifyRunIntent('mach es live')).toBe('agent');
  });

  it('ROUTES: a pure build intent (no publish) routes — "explicit intent executes directly"', () => {
    expect(classifyRunIntent('Baue mir eine Landingpage für mein Café.')).toBe('agent');
    expect(classifyRunIntent('Erstelle einen kleinen Rechner.')).toBe('agent');
    expect(classifyRunIntent('build me a portfolio site')).toBe('agent');
    expect(classifyRunIntent('create a todo app')).toBe('agent');
    expect(hasBuildIntent('Baue mir einen Habit-Tracker')).toBe(true);
  });

  it('STAYS CHAT: a chatty message merely MENTIONING "live"/"online" does not route', () => {
    // The guardrail case from the spec: do NOT auto-run the agent on every "live".
    expect(classifyRunIntent('Sieht die Live-Vorschau gut aus?')).toBe('chat');
    expect(classifyRunIntent('Ist die Seite eigentlich schon online?')).toBe('chat');
    expect(classifyRunIntent('Wie fühlt es sich an, wenn die Seite endlich live ist?')).toBe('chat');
    expect(shouldRouteToAgent('Ist die Seite schon online?')).toBe(false);
  });

  it('STAYS CHAT: questions and small talk without a build verb + object stay conversational', () => {
    expect(classifyRunIntent('Was ist der Unterschied zwischen Swift und Forge?')).toBe('chat');
    expect(classifyRunIntent('Danke, das sieht super aus!')).toBe('chat');
    expect(classifyRunIntent('Kannst du mir erklären, wie Deployment funktioniert?')).toBe('chat');
    // A bare verb with no buildable object does not route (edit/opinion phrasing).
    expect(classifyRunIntent('Mach das mal schöner.')).toBe('chat');
    expect(classifyRunIntent('Erzähl mir einen Witz.')).toBe('chat');
  });

  it('robust to casing + Umlaut spelling on the build path', () => {
    expect(classifyRunIntent('BAUE MIR EINE WEBSITE')).toBe('agent');
    expect(classifyRunIntent('erstelle eine zaehler-app')).toBe('agent'); // ä as ae
  });
});

describe('WAVE-F F2 — restore/undo intent', () => {
  it('GRANTS restore on clear undo/restore phrasing (DE + EN)', () => {
    for (const m of [
      'mach die letzte Änderung rückgängig',
      'Mach das bitte rückgängig',
      'stell den letzten Stand wieder her',
      'kannst du das wiederherstellen?',
      'geh zurück zur vorherigen Version',
      'undo the last change',
      'please revert that',
      'roll back to the previous version',
      'can you rollback?',
    ]) {
      expect(hasRestoreIntent(m)).toBe(true);
      expect(grantsRestore(m)).toBe(true);
      expect(classifyRunIntent(m)).toBe('agent'); // routes into an agent run
    }
  });

  it('does NOT confuse SAVE ("Stand sichern") with restore', () => {
    // The critical false-positive: saving is not undoing.
    expect(hasRestoreIntent('Stand sichern')).toBe(false);
    expect(hasRestoreIntent('sichere bitte den aktuellen Stand')).toBe(false);
    expect(hasRestoreIntent('Kannst du den Stand speichern?')).toBe(false);
  });

  it('does NOT grant restore on unrelated messages', () => {
    expect(hasRestoreIntent('Baue mir eine Website')).toBe(false);
    expect(hasRestoreIntent('stell die Seite live')).toBe(false);
    expect(hasRestoreIntent('Wie funktioniert das Deployment?')).toBe(false);
  });
});
