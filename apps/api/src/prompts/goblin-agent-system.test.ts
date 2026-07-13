// FEEL-3a A4 gate: prompt-level probes for the AGENT MODE system prompt.
// The prompt is the behavioral contract — assert the tools, protocol, honesty laws,
// and D1 publish scaffolding are present, and that the FORBIDDEN future-capability
// promise is absent.

import { describe, it, expect } from 'vitest';
import { buildAgentSystemPrompt, buildGoblinChatSystemPrompt } from './goblin-chat-system';

describe('AGENT MODE system prompt — A4', () => {
  const p = buildAgentSystemPrompt({ projectName: 'MeinProjekt' });

  it('declares all seven tools (incl. FEEL-3b publish + read_deploy_status)', () => {
    for (const tool of ['list_files', 'read_file', 'write_file', 'save_draft', 'publish', 'read_deploy_status', 'finish']) {
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

  it('includes the refusal few-shot (foreign-server deploy → honest limit)', () => {
    // FEEL-4 F4.3: the agent CAN search the web now, so the refusal example no longer
    // claims "keinen Web-Zugriff" — it refuses only the foreign-server deploy.
    expect(p).toMatch(/fremden Server/);
    expect(p).not.toMatch(/keinen Web-Zugriff/);
  });

  it('D1 semantics: publish allowed only on explicit intent in THIS message, else chip', () => {
    expect(p).toMatch(/in DIESER Nachricht verlangt/);
    expect(p).toMatch(/Bestätigungs-Chip/);
    expect(p).toMatch(/Im Zweifel: nicht veröffentlichen/);
  });

  it('bounded self-heal few-shot: red publish gate → fix → re-publish, max 2 cycles', () => {
    expect(p).toMatch(/Höchstens ZWEI Korrekturversuche/);
    expect(p).toMatch(/styles\.css nicht erreichbar/);
  });

  it('honesty: "Live" only after a green publish, never an invented URL', () => {
    expect(p).toMatch(/erfinde NIE eine Live-URL/);
    expect(p).not.toMatch(/bald direkt ich/);
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

  // K2 (Wave-K, Layer 2) — the generation-time refusal POLICY section rides in BOTH
  // the agent prompt and normal chat, with the ABSOLUTE block + the refuse/refuse/build
  // few-shot triple (③ is the false-positive guard).
  describe('K2 POLICY section — generation-time refusal', () => {
    const chat = buildGoblinChatSystemPrompt({ projectName: 'X' });
    for (const [label, prompt] of [['agent', p], ['chat', chat]] as const) {
      it(`${label} prompt carries the ABSOLUTE policy block + prohibited classes`, () => {
        expect(prompt).toMatch(/ABSOLUTE REGEL — was du NICHT baust/);
        expect(prompt).toMatch(/Phishing/);
        expect(prompt).toMatch(/Krypto-Miner/);
        expect(prompt).toMatch(/Marken-Imitation/);
      });
      it(`${label} prompt teaches the boundary with the refuse/refuse/build few-shots`, () => {
        expect(prompt).toContain('Beispiel P1'); // brand-imitation → refuse
        expect(prompt).toContain('Beispiel P2'); // card form + mail → refuse + Stripe
        expect(prompt).toContain('Beispiel P3'); // own-app login → build (false-positive guard)
        expect(prompt).toMatch(/Stripe Payment Links/);
      });
      it(`${label} prompt refusals name the legitimate path, never a bare "kann ich nicht"`, () => {
        expect(prompt).toMatch(/nie ein nacktes "das kann ich nicht"/);
        expect(prompt).toMatch(/EIGENE App des Nutzers ist dagegen normal/);
      });
    }
  });

  // F-21 — web-search capability map is honest and mode-scoped. In the walk the base
  // chat blanket-denied ("Ich kann nicht im Web suchen") even though FEEL-4 shipped a
  // real search adapter reachable in agent runs. Base chat must decline BY MODE (not
  // deny the capability), and the agent prompt must tell the model it CAN search.
  describe('F-21 — web search capability map is honest', () => {
    const chat = buildGoblinChatSystemPrompt({ projectName: 'X' });

    it('base chat declines by MODE and points to agent runs — never a blanket denial', () => {
      expect(chat).toMatch(/in einem Agent-Run KANN Goblin das Web durchsuchen/);
      expect(chat).toMatch(/In diesem Chat-Modus suche ich nicht live/);
      // The old blanket "can't search at all" claim is gone.
      expect(chat).not.toMatch(/Nicht im Web suchen oder Live-Daten abrufen/);
      // The identity example no longer uses web search as an absolute limit.
      expect(chat).toMatch(/Ich kann keine Bilder ansehen/);
    });

    it('agent prompt WITH a resolved provider tells the model it CAN search + cite', () => {
      const agentWithSearch = buildAgentSystemPrompt({ projectName: 'X', searchAvailable: true });
      expect(agentWithSearch).toMatch(/du KANNST in diesem Lauf im Web suchen/);
      expect(agentWithSearch).toMatch(/Quelle/);
      // Without a provider, the search block is absent (honest: no false capability).
      expect(buildAgentSystemPrompt({ projectName: 'X' })).not.toMatch(/du KANNST in diesem Lauf im Web suchen/);
    });
  });

  // R1 (F-28) — the no-roadmap / no-future-feature ABSOLUTE block rides in BOTH the
  // agent prompt and normal chat: the model invented a GitLab roadmap in the walk, so
  // the rule + the exact-failure few-shot must be present on every generative surface.
  describe('R1 — no invented roadmap / timeline (F-28)', () => {
    const chat = buildGoblinChatSystemPrompt({ projectName: 'X' });
    for (const [label, prompt] of [['agent', p], ['chat', chat]] as const) {
      it(`${label} prompt carries the ABSOLUTE no-roadmap block + the honest canonical line`, () => {
        expect(prompt).toMatch(/ABSOLUTE REGEL — keine Roadmap, keine Zukunfts-Features \(R1\)/);
        expect(prompt).toMatch(/Das gibt es heute nicht\. Ob und wann es kommt, kann ich dir nicht sagen\./);
        // The forbidden roadmap phrasings are named as prohibited.
        expect(prompt).toMatch(/in den nächsten Updates/);
      });
      it(`${label} prompt teaches the exact GitLab failure case as a few-shot`, () => {
        expect(prompt).toContain('Beispiel R1');
        expect(prompt).toMatch(/GitLab-Konnektor/);
      });
    }
  });
});
