// FW4 U1 (F-11): the web mirror must agree with the server's routing gate on the
// verbatim W10 walk prompt and the guardrail cases. If this drifts from
// apps/api/src/services/agent/intent.ts, routing and the server grant disagree.

import { describe, it, expect } from 'vitest';
import { shouldRouteToAgent } from '@/lib/run-intent';

describe('run-intent (web mirror) — the W10 routing gate', () => {
  const WALK_PROMPT = 'Baue mir einen kleinen Habit-Tracker mit Datum und Häkchen. Und stell ihn live.';

  it('ROUTES the verbatim walk prompt to an agent run', () => {
    expect(shouldRouteToAgent(WALK_PROMPT)).toBe(true);
  });

  it('ROUTES pure publish and pure build intents', () => {
    expect(shouldRouteToAgent('Stell die Seite jetzt live.')).toBe(true);
    expect(shouldRouteToAgent('publish it')).toBe(true);
    expect(shouldRouteToAgent('Baue mir eine Landingpage für mein Café.')).toBe(true);
    expect(shouldRouteToAgent('build me a portfolio site')).toBe(true);
  });

  it('STAYS CHAT on a chatty mention of "live"/"online" (the guardrail)', () => {
    expect(shouldRouteToAgent('Sieht die Live-Vorschau gut aus?')).toBe(false);
    expect(shouldRouteToAgent('Ist die Seite eigentlich schon online?')).toBe(false);
    expect(shouldRouteToAgent('Wie funktioniert Deployment eigentlich?')).toBe(false);
    expect(shouldRouteToAgent('Mach das mal schöner.')).toBe(false);
    expect(shouldRouteToAgent('Danke, das sieht super aus!')).toBe(false);
  });
});
