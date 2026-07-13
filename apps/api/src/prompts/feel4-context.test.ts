// FEEL-4 gate (deterministic half): the prompt is the behavioral contract, so
// prove at the builder level that F4.1 project instructions and F4.2 user
// preferences render, sit in the right place, and — crucially — that EVERY F4.2
// option changes the prompt in BOTH directions (no placebo toggles, spec §3 / probe
// 6.3). The live real-model flip is proven separately in _sprint/feel-4 once the
// authored migration 0082 is applied.

import { describe, it, expect } from 'vitest';
import { buildAgentSystemPrompt, buildGoblinChatSystemPrompt } from './goblin-chat-system';

describe('F4.1 — project instructions injection', () => {
  it('renders instructions marked as user-authored, ABOVE the rolling memory', () => {
    const p = buildGoblinChatSystemPrompt({
      projectName: 'Shop',
      projectInstructions: 'Immer deutsches UI. Farbschema: violett.',
      projectState: { summary: 'Landing page steht.', decisions: 'Stack: HTML/CSS.' },
    });
    expect(p).toContain('Projekt-Anweisungen des Nutzers');
    expect(p).toContain('Immer deutsches UI. Farbschema: violett.');
    // Ordering: instructions block must precede the rolling-memory block.
    expect(p.indexOf('Projekt-Anweisungen des Nutzers')).toBeLessThan(
      p.indexOf('Bisheriger Stand & Entscheidungen'),
    );
  });

  it('renders nothing when instructions are empty', () => {
    const p = buildGoblinChatSystemPrompt({ projectName: 'Shop', projectInstructions: '   ' });
    expect(p).not.toContain('Projekt-Anweisungen des Nutzers');
  });

  it('flows into agent runs (probe 6.1 path)', () => {
    const p = buildAgentSystemPrompt({ projectName: 'Shop', projectInstructions: 'Keine externen Fonts.' });
    expect(p).toContain('Keine externen Fonts.');
  });
});

describe('F4.2 — user preferences inject globally and are non-placebo', () => {
  it('address name appears, and is absent when unset', () => {
    const withName = buildGoblinChatSystemPrompt({ userPreferences: { addressName: 'Vincent' } });
    expect(withName).toMatch(/»Vincent«/);
    const without = buildGoblinChatSystemPrompt({ userPreferences: { addressName: '' } });
    expect(without).not.toContain('Nutzer-Präferenzen');
  });

  it('response style flips the register instruction (both directions differ)', () => {
    const knapp = buildGoblinChatSystemPrompt({ userPreferences: { responseStyle: 'knapp' } });
    const ausf = buildGoblinChatSystemPrompt({ userPreferences: { responseStyle: 'ausfuehrlich' } });
    expect(knapp).toMatch(/KNAPP/);
    expect(ausf).toMatch(/AUSFÜHRLICH/);
    expect(knapp).not.toEqual(ausf);
  });

  it('explain-changes flips on/off (no placebo)', () => {
    const on = buildGoblinChatSystemPrompt({ userPreferences: { explainChanges: true } });
    const off = buildGoblinChatSystemPrompt({ userPreferences: { explainChanges: false } });
    expect(on).toMatch(/Erklärtiefe: AN/);
    expect(off).toMatch(/Erklärtiefe: AUS/);
    expect(on).not.toEqual(off);
  });

  it('explain-changes targets the finish report in agent runs (probe 6.3 report card)', () => {
    const on = buildAgentSystemPrompt({ projectName: 'X', userPreferences: { explainChanges: true } });
    const off = buildAgentSystemPrompt({ projectName: 'X', userPreferences: { explainChanges: false } });
    expect(on).toMatch(/finish-Bericht.*WARUM/s);
    expect(off).toMatch(/finish-Bericht knapp/);
  });

  it('custom instructions (already-live 0048 field) now inject globally — placebo fixed', () => {
    const p = buildGoblinChatSystemPrompt({ userPreferences: { customInstructions: 'Bevorzuge TypeScript.' } });
    expect(p).toContain('Persönliche Anweisungen des Nutzers');
    expect(p).toContain('Bevorzuge TypeScript.');
  });

  it('injects even in a standalone (no-project) chat', () => {
    const p = buildGoblinChatSystemPrompt({ userPreferences: { responseStyle: 'knapp' } });
    expect(p).toContain('Nutzer-Präferenzen');
    expect(p).not.toContain('Aktueller Projektkontext'); // no project block
  });
});

describe('F4.3 — web capability is honest and conditional', () => {
  it('base chat declines web search BY MODE (F-21) — never a blanket denial', () => {
    const p = buildGoblinChatSystemPrompt({ projectName: 'X' });
    // F-21: the old blanket "Nicht im Web suchen oder Live-Daten abrufen" is gone;
    // base chat now declines by mode and points to agent runs (honest, not a denial).
    expect(p).not.toMatch(/Nicht im Web suchen oder Live-Daten abrufen/);
    expect(p).toMatch(/in einem Agent-Run KANN Goblin das Web durchsuchen/);
    expect(p).not.toContain('web_search'); // base chat still has no search TOOL
  });

  it('agent run WITHOUT a provider does not advertise web_search', () => {
    const p = buildAgentSystemPrompt({ projectName: 'X' });
    expect(p).not.toContain('web_search');
    // the stale "kein Web-Zugriff" claim is gone from the refusal example
    expect(p).not.toContain('keinen Web-Zugriff');
  });

  it('agent run WITH a provider advertises web_search + the citation rule', () => {
    const p = buildAgentSystemPrompt({ projectName: 'X', searchAvailable: true });
    expect(p).toContain('web_search');
    expect(p).toMatch(/Quelle: <url>/);
  });
});
