// WAVE D-G U3 — chat-register touch-up gate. The register bullet (calm, competent
// colleague; no habitual sales-closers) rides in IDENTITY, so it flows into BOTH the
// base chat and the agent prompt. This is a deterministic guard that the touch-up is
// present on both paths AND that the F-25 "knapp" honesty few-shot is NOT regressed.

import { describe, it, expect } from 'vitest';
import { buildAgentSystemPrompt, buildGoblinChatSystemPrompt } from './goblin-chat-system';

describe('U3 chat register — calm colleague, no habitual sales-closers', () => {
  const chat = buildGoblinChatSystemPrompt({ projectName: 'X' });
  const agent = buildAgentSystemPrompt({ projectName: 'X' });

  it('applies to the base CHAT register (a conversational answer)', () => {
    expect(chat).toMatch(/ruhiger, kompetenter Kollege/);
    expect(chat).toMatch(/ohne Vorrede/);
  });

  it('does NOT touch the agent narration voice — it keeps its terse step-stream', () => {
    // The task scopes U3 to the chat register; agent narration stays "ein knapper Satz
    // pro Schritt", so the conversational register bullet must NOT bleed into agent mode.
    expect(agent).not.toMatch(/ruhiger, kompetenter Kollege/);
    expect(agent).toMatch(/ein knapper Satz pro Schritt/);
  });

  it('names the habitual sales/pep closers it forbids — and keeps the honest next-step', () => {
    // The prohibited closers are named as the exact anti-pattern (house model-behavior law).
    expect(chat).toMatch(/Viel Erfolg beim Bauen/);
    expect(chat).toMatch(/Happy Coding/);
    expect(chat).toMatch(/wie ein Verkaufsabschluss/);
    // The legitimate hand-off (which click next) is explicitly still welcome.
    expect(chat).toMatch(/echter nächster Schritt/);
  });

  it('does NOT regress the F-25 "knapp" honesty few-shot', () => {
    const knapp = buildGoblinChatSystemPrompt({ userPreferences: { responseStyle: 'knapp' } });
    expect(knapp).toMatch(/KNAPP \(verbindlich\)/);
    expect(knapp).toMatch(/KEIN Verkaufsabschluss/);
  });

  it('does NOT regress the A1 no-claimed-platform-actions honesty law', () => {
    expect(chat).toMatch(/keine behaupteten Plattform-Aktionen \(A1\)/);
  });
});
