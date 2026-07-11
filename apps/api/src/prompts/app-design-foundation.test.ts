// A-2 (WAVE-A) gate — the design foundation is injected into agent-mode generation,
// scoped to the GENERATED app (not Goblin's own UI), compact, and absent from base chat.

import { describe, it, expect } from 'vitest';
import { APP_DESIGN_FOUNDATION } from './app-design-foundation';
import { buildAgentSystemPrompt, buildGoblinChatSystemPrompt } from './goblin-chat-system';

describe('A-2 app design foundation', () => {
  it('stays under the ~1.5k-token budget', () => {
    // Conservative chars/token ~3.3 for German; assert well under 1500 tokens.
    expect(APP_DESIGN_FOUNDATION.length / 3.3).toBeLessThan(1500);
  });

  it('is injected into every agent run (shapes what the agent BUILDS)', () => {
    const p = buildAgentSystemPrompt({ projectName: 'X' });
    expect(p).toContain(APP_DESIGN_FOUNDATION);
    // Carries the concrete floor: system font stack, spacing scale, dark mode, mobile-first.
    expect(p).toMatch(/system-ui/);
    expect(p).toMatch(/prefers-color-scheme: dark/);
    expect(p).toMatch(/width=device-width/);
  });

  it('is explicitly scoped to the generated app, NOT Goblin itself, and defers to the user', () => {
    expect(APP_DESIGN_FOUNDATION).toMatch(/NICHT für Goblin/);
    expect(APP_DESIGN_FOUNDATION).toMatch(/Vorrang/); // user's own design wins
    expect(APP_DESIGN_FOUNDATION).toMatch(/[Kk]eine externen CSS-Frameworks/);
  });

  it('does NOT leak into the base (non-agent) chat prompt', () => {
    const normal = buildGoblinChatSystemPrompt({ projectName: 'X' });
    expect(normal).not.toContain(APP_DESIGN_FOUNDATION);
  });
});
