// MOBILE-1 · M3 — anchored instruction payload (spec §3, Tier 2).
//
// A Tier-2 "Diese Stelle ändern lassen" sends a NORMAL chat message that carries
// a structured anchor: the file, the 1-based line range, and ±SURROUNDING_LINES
// of surrounding code so the model (which since FEEL-2 sees the real file) can
// make a targeted edit. The result still lands as a reviewed GEÄNDERT draft — no
// auto-apply.
//
// Consumption knob (ledger M7): SURROUNDING_LINES governs the added input tokens
// per anchored send. 10 lines each side ≈ a few hundred input tokens. Raising it
// gives the model more context (better targeting) at a linear token cost.

/** ±lines of surrounding code included around the anchored range. Ledger M7 knob. */
export const SURROUNDING_LINES = 10;

export interface AnchorPayload {
  file: string;
  /** 1-based inclusive line range the user pointed at. */
  from: number;
  to: number;
}

/**
 * Build the chat message for an anchored instruction. Deterministic and pure so
 * the anchor payload is verifiable in tests/E2E without a model round-trip.
 */
export function buildAnchoredMessage(instruction: string, anchor: AnchorPayload, fileContent: string): string {
  const lines = fileContent.split("\n");
  const total = lines.length;
  const from = Math.max(1, Math.min(anchor.from, total));
  const to = Math.max(from, Math.min(anchor.to, total));
  const ctxFrom = Math.max(1, from - SURROUNDING_LINES);
  const ctxTo = Math.min(total, to + SURROUNDING_LINES);
  const snippet = lines
    .slice(ctxFrom - 1, ctxTo)
    .map((l, i) => `${ctxFrom + i}\t${l}`)
    .join("\n");
  const rangeLabel = from === to ? `Zeile ${from}` : `Zeile ${from}–${to}`;
  return (
    `${instruction.trim()}\n\n` +
    `[Anker → ${anchor.file} · ${rangeLabel}] Ändere gezielt diese Stelle in \`${anchor.file}\`. ` +
    `Zur Orientierung die Umgebung (Zeilen ${ctxFrom}–${ctxTo}, mit Zeilennummern):\n` +
    "```\n" + snippet + "\n```"
  );
}
