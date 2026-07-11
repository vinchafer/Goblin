// A-1 (TTFT / prefix caching) gate — DETERMINISTIC prefix-stability.
//
// DeepInfra caches by prompt prefix (automatic, prefix-based). The cache only pays off
// if the static blocks (identity, ABSOLUTE rules, tool docs, few-shots) are byte-IDENTICAL
// across runs and come BEFORE any per-run dynamic block (project files, memory, prefs).
// These probes prove that property on real bytes, so a future prompt edit that accidentally
// injects dynamic content into the prefix — or reorders the tail ahead of it — fails CI
// instead of silently killing the cache hit (and the TTFT win) in production.

import { describe, it, expect } from 'vitest';
import { buildAgentSystemPrompt, buildGoblinChatSystemPrompt, AGENT_STATIC_PREFIX } from './goblin-chat-system';

// Two maximally-different dynamic contexts: different project, files, memory, prefs.
const CTX_A = {
  projectName: 'Habit-Tracker',
  files: [{ path: 'index.html', size: 1200, content: '<!doctype html><h1>A</h1>' }],
  projectInstructions: 'Immer dark-mode-first.',
  projectState: { summary: 'Stand A', decisions: 'Entscheidung A' },
  userPreferences: { addressName: 'Vincent', responseStyle: 'knapp' as const, explainChanges: true },
} satisfies Parameters<typeof buildAgentSystemPrompt>[0];

const CTX_B = {
  projectName: 'Rechnungs-App',
  files: [{ path: 'app.js', size: 9999, content: 'console.log("B")' }],
  projectInstructions: 'Nur Vanilla-JS.',
  projectState: { summary: 'Stand B ganz anders', decisions: 'Entscheidung B' },
  userPreferences: { addressName: 'Chef', responseStyle: 'ausfuehrlich' as const, explainChanges: false },
} satisfies Parameters<typeof buildAgentSystemPrompt>[0];

describe('A-1 agent prompt — static prefix is byte-stable for prefix caching', () => {
  it('every build starts with the exact static prefix (byte-identical)', () => {
    for (const ctx of [{}, CTX_A, CTX_B, { searchAvailable: true, ...CTX_A }]) {
      const built = buildAgentSystemPrompt(ctx);
      expect(built.startsWith(AGENT_STATIC_PREFIX)).toBe(true);
    }
  });

  it('two runs with totally different dynamic context share a byte-identical leading prefix', () => {
    const a = buildAgentSystemPrompt(CTX_A);
    const b = buildAgentSystemPrompt(CTX_B);
    // Find the first byte at which they diverge — it must be at/after the static prefix,
    // i.e. the whole static prefix is common to both.
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    expect(i).toBeGreaterThanOrEqual(AGENT_STATIC_PREFIX.length);
    expect(a.slice(0, AGENT_STATIC_PREFIX.length)).toBe(b.slice(0, AGENT_STATIC_PREFIX.length));
  });

  it('the dynamic tail (project name / prefs) lives AFTER the static prefix, never inside it', () => {
    // None of the per-run values may leak into the cached prefix.
    for (const needle of ['Habit-Tracker', 'Vincent', 'Stand A', 'Immer dark-mode-first']) {
      expect(AGENT_STATIC_PREFIX.includes(needle)).toBe(false);
    }
    const built = buildAgentSystemPrompt(CTX_A);
    expect(built).toContain('Habit-Tracker'); // present, but only in the tail
    expect(built.indexOf('Habit-Tracker')).toBeGreaterThan(AGENT_STATIC_PREFIX.length);
  });

  it('the search block splits the cache but stays byte-stable per boolean', () => {
    const noSearch1 = buildAgentSystemPrompt(CTX_A);
    const noSearch2 = buildAgentSystemPrompt(CTX_B);
    const search1 = buildAgentSystemPrompt({ ...CTX_A, searchAvailable: true });
    const search2 = buildAgentSystemPrompt({ ...CTX_B, searchAvailable: true });
    // Same-boolean runs share the (longer) prefix through the search block; the search
    // block itself is identical wherever it appears.
    const commonLen = (x: string, y: string) => { let i = 0; while (i < x.length && i < y.length && x[i] === y[i]) i++; return i; };
    expect(commonLen(search1, search2)).toBeGreaterThan(commonLen(noSearch1, noSearch2));
    expect(commonLen(search1, search2)).toBeGreaterThan(AGENT_STATIC_PREFIX.length);
  });

  it('normal chat prompt is also identity-first with the dynamic tail appended last', () => {
    const a = buildGoblinChatSystemPrompt({ projectName: 'Alpha' });
    const b = buildGoblinChatSystemPrompt({ projectName: 'Beta' });
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    // The shared identity prefix is substantial (the whole IDENTITY block), and the
    // divergence (project name) comes only after it.
    expect(i).toBeGreaterThan(2000);
    expect(a.slice(0, i)).not.toContain('Alpha');
  });
});
