// FEEL-3a — the strict JSON tool protocol (mandatory fallback path, spec §4).
//
// Native function calling (DeepInfra, DeepSeek) is the primary path. But BYOK/free
// models in the selector vary wildly, and the empirical law (A1/E7) is that on this
// model class an explicit protocol beats elegance. So when a turn yields no native
// tool_calls, we look for exactly one fenced `tool_call` object in the text:
//
//   ```tool_call
//   { "tool": "write_file", "args": { "path": "index.html", "content": "..." } }
//   ```
//
// Parsed + schema-validated with zod. A parse/schema failure earns exactly ONE
// repair reprompt (REPAIR_INSTRUCTION), then the loop aborts honestly into finish.

import { z } from 'zod';
import type { ToolCall } from './types';

const ToolCallSchema = z.object({
  tool: z.string().min(1),
  args: z.record(z.unknown()).optional(),
});

/** Outcome of trying to read a fallback tool_call out of a turn's text. */
export type ParseOutcome =
  | { kind: 'call'; call: ToolCall }
  | { kind: 'none' } // no fenced tool_call present at all (plain prose)
  | { kind: 'malformed'; detail: string }; // a tool_call fence was present but unparseable/invalid

const FENCE_RE = /```tool_call\s*\n([\s\S]*?)```/i;

let fallbackIdSeq = 0;

/**
 * Extract a single fallback tool_call from assistant text. Returns 'none' when no
 * `tool_call` fence exists (the model answered in prose — a legitimate refusal/finish),
 * and 'malformed' when a fence exists but the JSON/schema is invalid (→ repair).
 */
export function parseFallbackToolCall(text: string): ParseOutcome {
  const m = text.match(FENCE_RE);
  if (!m) return { kind: 'none' };
  const body = (m[1] ?? '').trim();
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch (e) {
    return { kind: 'malformed', detail: `JSON parse error: ${(e as Error).message}` };
  }
  const parsed = ToolCallSchema.safeParse(json);
  if (!parsed.success) {
    return { kind: 'malformed', detail: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  fallbackIdSeq += 1;
  return {
    kind: 'call',
    call: { id: `fb_${fallbackIdSeq}`, name: parsed.data.tool, args: parsed.data.args ?? {} },
  };
}

/** The single repair reprompt appended after a malformed tool_call, before the honest abort. */
export const REPAIR_INSTRUCTION =
  'Deine letzte Antwort enthielt einen fehlerhaften `tool_call`. Antworte mit GENAU EINEM ' +
  'umzäunten `tool_call`-Block, dessen Inhalt gültiges JSON `{ "tool": "...", "args": { ... } }` ist. ' +
  'Kein weiterer Text. Wenn du fertig bist, rufe stattdessen das Werkzeug `finish` auf.';
