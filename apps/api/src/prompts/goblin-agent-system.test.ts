// FEEL-3a A4 gate: prompt-level probes for the AGENT MODE system prompt.
// The prompt is the behavioral contract — assert the tools, protocol, honesty laws,
// and D1 publish scaffolding are present, and that the FORBIDDEN future-capability
// promise is absent.

import { describe, it, expect } from 'vitest';
import { buildAgentSystemPrompt, buildGoblinChatSystemPrompt } from './goblin-chat-system';

describe('AGENT MODE system prompt — A4', () => {
  const p = buildAgentSystemPrompt({ projectName: 'MeinProjekt' });

  it('declares all five tools', () => {
    for (const tool of ['list_files', 'read_file', 'write_file', 'save_draft', 'finish']) {
      expect(p).toContain(tool);
    }
  });

  it('frames tools as the ONLY way to act and narration as description, not action', () => {
    expect(p).toMatch(/EINZIGE Weg zu handeln/);
    expect(p).toMatch(/BESCHREIBEN nur/);
  });

  it('carries the strict JSON tool_call fallback protocol', () => {
    expect(p).toContain('tool_call');
    expect(p).toMatch(/GENAU EIN/);
  });

  it('keeps the E7 no-invented-file-contents law', () => {
    expect(p).toMatch(/erfinde niemals den Inhalt einer Datei, die du nicht gelesen hast/);
  });

  it('includes the failure few-shot (tool error → one retry → honest finish)', () => {
    expect(p).toContain('not_found');
    expect(p).toMatch(/weiteres Mal korrigiert/);
  });

  it('includes the refusal few-shot (web search / foreign-server deploy → honest limit)', () => {
    expect(p).toMatch(/keinen Web-Zugriff/);
    expect(p).toMatch(/fremden Server/);
  });

  it('D1 scaffolding: publish is unavailable → honest "Live stellen" pointer', () => {
    expect(p).toMatch(/KEIN Werkzeug zum Veröffentlichen/);
    expect(p).toMatch(/‚Live stellen' im Code-Bereich/);
  });

  it('FORBIDS promising future capability (no "bald direkt ich")', () => {
    expect(p).not.toMatch(/bald direkt ich/);
    // the prompt explicitly names this as forbidden, but must not itself make the promise
    expect(p).toMatch(/VERBOTEN ist jedes Versprechen künftiger Fähigkeiten/);
  });

  it('still renders the live project context (shared with normal chat)', () => {
    expect(p).toContain('MeinProjekt');
    expect(p).toMatch(/Aktueller Projektkontext/);
  });

  it('normal chat prompt is unchanged by the refactor (A1 rule intact)', () => {
    const normal = buildGoblinChatSystemPrompt({ projectName: 'X' });
    expect(normal).toMatch(/keine behaupteten Plattform-Aktionen \(A1\)/);
    expect(normal).toContain('X');
    // normal chat does NOT carry the agent tool block.
    expect(normal).not.toContain('AGENT-MODUS');
  });
});
