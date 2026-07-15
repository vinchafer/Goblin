// A-2 (WAVE-A → WAVE D-G) gate — the design foundation is the beauty contract for
// GENERATED apps. WAVE D-G upgrades it from a system-font "floor" to an opinionated
// indie-designer contract (font PAIRING, :root palette, mood, BAD/GOOD few-shot) and —
// the U2 decision — injects it into BOTH generation paths (agent mode AND base chat
// code-gen), where WAVE-A had kept it agent-only. It is scoped to the generated app
// (not Goblin's own UI), stays in the cached static region, and defers to the user.

import { describe, it, expect } from 'vitest';
import { APP_DESIGN_FOUNDATION } from './app-design-foundation';
import { buildAgentSystemPrompt, buildGoblinChatSystemPrompt, AGENT_STATIC_PREFIX } from './goblin-chat-system';

describe('A-2 app design foundation (WAVE D-G beauty block)', () => {
  it('stays within a bounded token budget (rides the cached prefix, so warm after turn 1)', () => {
    // Conservative German chars/token ~2.6; assert the block stays under ~2.2k tokens.
    // Measured real delta (DeepInfra tokenizer) is recorded in the consumption ledger.
    expect(APP_DESIGN_FOUNDATION.length / 2.6).toBeLessThan(2200);
  });

  it('is injected into BOTH generation paths (agent AND base chat code-gen)', () => {
    const agent = buildAgentSystemPrompt({ projectName: 'X' });
    const chat = buildGoblinChatSystemPrompt({ projectName: 'X' });
    expect(agent).toContain(APP_DESIGN_FOUNDATION);
    expect(chat).toContain(APP_DESIGN_FOUNDATION);
  });

  it('rides the byte-stable cached static prefix on the agent path', () => {
    expect(AGENT_STATIC_PREFIX).toContain(APP_DESIGN_FOUNDATION);
  });

  it('carries the WAVE D-G taste contract: font pairing, :root palette, mood, mobile-first', () => {
    // Intentional typography — a Google-Font PAIRING, not a bare system stack.
    expect(APP_DESIGN_FOUNDATION).toMatch(/Font-Pairing/);
    expect(APP_DESIGN_FOUNDATION).toMatch(/display=swap/);
    expect(APP_DESIGN_FOUNDATION).toMatch(/clamp\(/);
    // A theme-derived palette as :root custom properties.
    expect(APP_DESIGN_FOUNDATION).toMatch(/:root/);
    expect(APP_DESIGN_FOUNDATION).toMatch(/Custom-Propert/);
    // The three named moods.
    expect(APP_DESIGN_FOUNDATION).toMatch(/Editorial/);
    expect(APP_DESIGN_FOUNDATION).toMatch(/Soft Craft/);
    expect(APP_DESIGN_FOUNDATION).toMatch(/Bold Minimal/);
    // Mobile-first + dark mode + the viewport skeleton (unchanged good bones).
    expect(APP_DESIGN_FOUNDATION).toMatch(/prefers-color-scheme: dark/);
    expect(APP_DESIGN_FOUNDATION).toMatch(/width=device-width/);
    expect(APP_DESIGN_FOUNDATION).toMatch(/44px/);
  });

  it('bans the framework defaults it is meant to replace (Bootstrap-blue, system-ui-only)', () => {
    // The BAD few-shot names the exact anti-pattern the founder called "ok, nicht wow".
    expect(APP_DESIGN_FOUNDATION).toMatch(/#007bff/);
    expect(APP_DESIGN_FOUNDATION).toMatch(/Bootstrap/);
    expect(APP_DESIGN_FOUNDATION).toMatch(/system-ui/);
    // And it teaches by contrast — a GOOD counterpart is present.
    expect(APP_DESIGN_FOUNDATION).toMatch(/So RICHTIG/);
  });

  it('is explicitly scoped to the generated app, NOT Goblin itself, and defers to the user', () => {
    expect(APP_DESIGN_FOUNDATION).toMatch(/NICHT für Goblin/);
    expect(APP_DESIGN_FOUNDATION).toMatch(/Vorrang/); // user's own design wins
    expect(APP_DESIGN_FOUNDATION).toMatch(/[Kk]eine externen CSS-Frameworks/);
  });
});
