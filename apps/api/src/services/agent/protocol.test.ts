// FEEL-3c C1 — the strict JSON tool protocol fallback, hardened.
//
// The fixture suite the C1 gate demands: malformed-output cases (prose+JSON mixed,
// two calls in one turn, wrong arg types) plus the happy paths and the repair-reprompt
// contract (exact violation quoted). This is the parser's safety net for the whole
// efficient-model class — the deeper cause of the FEEL-3b W10 protocol-mixing flake.

import { describe, it, expect } from 'vitest';
import { parseFallbackToolCall, buildRepairInstruction, REPAIR_INSTRUCTION } from './protocol';

const fence = (body: string) => '```tool_call\n' + body + '\n```';

describe('parseFallbackToolCall — happy paths', () => {
  it('parses a clean single fenced tool_call', () => {
    const out = parseFallbackToolCall(fence('{ "tool": "write_file", "args": { "path": "index.html", "content": "x" } }'));
    expect(out.kind).toBe('call');
    if (out.kind === 'call') {
      expect(out.call.name).toBe('write_file');
      expect(out.call.args).toEqual({ path: 'index.html', content: 'x' });
      expect(out.call.id).toMatch(/^fb_/);
    }
  });

  it('tolerates a no-args tool (args optional → {})', () => {
    const out = parseFallbackToolCall(fence('{ "tool": "list_files" }'));
    expect(out.kind).toBe('call');
    if (out.kind === 'call') expect(out.call.args).toEqual({});
  });

  it('prose BEFORE a single fence still resolves the call (the model narrated, then acted)', () => {
    const text = 'Ich lege jetzt die Datei an.\n\n' + fence('{ "tool": "save_draft" }');
    const out = parseFallbackToolCall(text);
    expect(out.kind).toBe('call');
    if (out.kind === 'call') expect(out.call.name).toBe('save_draft');
  });

  it('plain prose with no fence is "none" (a legitimate refusal / wrap-up, not an error)', () => {
    const out = parseFallbackToolCall('Das kann ich mit meinen Werkzeugen nicht — ich habe keinen Web-Zugriff.');
    expect(out.kind).toBe('none');
  });
});

describe('parseFallbackToolCall — malformed fixtures (C1 gate)', () => {
  it('two tool_call fences in one turn → malformed (never silently drop the second)', () => {
    const text =
      fence('{ "tool": "write_file", "args": { "path": "index.html", "content": "a" } }') +
      '\n\n' +
      fence('{ "tool": "write_file", "args": { "path": "style.css", "content": "b" } }');
    const out = parseFallbackToolCall(text);
    expect(out.kind).toBe('malformed');
    if (out.kind === 'malformed') expect(out.detail).toMatch(/2 tool_call-Blöcke/);
  });

  it('prose+JSON mixed with invalid JSON body → malformed with a syntax detail', () => {
    // Trailing comma — invalid JSON inside the fence.
    const out = parseFallbackToolCall('Los gehts:\n' + fence('{ "tool": "write_file", "args": { "path": "x", } }'));
    expect(out.kind).toBe('malformed');
    if (out.kind === 'malformed') expect(out.detail).toMatch(/JSON-Syntaxfehler/);
  });

  it('wrong arg types: "tool" is a number → malformed, violation names the field', () => {
    const out = parseFallbackToolCall(fence('{ "tool": 42, "args": {} }'));
    expect(out.kind).toBe('malformed');
    if (out.kind === 'malformed') expect(out.detail).toMatch(/tool/);
  });

  it('wrong arg types: "args" is an array, not an object → malformed', () => {
    const out = parseFallbackToolCall(fence('{ "tool": "write_file", "args": [1,2,3] }'));
    expect(out.kind).toBe('malformed');
    if (out.kind === 'malformed') expect(out.detail).toMatch(/args/);
  });

  it('empty tool name → malformed (min length)', () => {
    const out = parseFallbackToolCall(fence('{ "tool": "", "args": {} }'));
    expect(out.kind).toBe('malformed');
  });

  it('a fence whose body is not JSON at all → malformed', () => {
    const out = parseFallbackToolCall(fence('write_file(index.html)'));
    expect(out.kind).toBe('malformed');
    if (out.kind === 'malformed') expect(out.detail).toMatch(/JSON-Syntaxfehler/);
  });
});

describe('buildRepairInstruction — quotes the exact violation (C1)', () => {
  it('embeds the violation detail verbatim so the model fixes THAT mistake', () => {
    const detail = '2 tool_call-Blöcke gefunden — pro Antwort ist genau EINER erlaubt';
    const msg = buildRepairInstruction(detail);
    expect(msg).toContain(detail);
    expect(msg).toMatch(/GENAU EINEM/);
    expect(msg).toMatch(/finish/); // the honest way out is always named
  });

  it('without a detail falls back to the generic instruction (REPAIR_INSTRUCTION)', () => {
    expect(buildRepairInstruction()).toBe(REPAIR_INSTRUCTION);
    expect(REPAIR_INSTRUCTION).not.toMatch(/Der Fehler war/);
  });
});
