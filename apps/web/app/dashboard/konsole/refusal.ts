/**
 * AKT 2 · PHASE 2.5 · U-A3 — turning an API answer into something a founder can act on.
 *
 * ── Why this is its own module ───────────────────────────────────────────────
 * It is the console's single translation point: every failed request, on every
 * card, becomes text HERE and nowhere else. That was already true inside
 * console-client.tsx; what it was not, was testable — the logic sat inside a
 * closure in a React client component, so the one rule that matters ("a refusal is
 * named as a refusal, and nothing else is") could only be checked by eye.
 *
 * ── The rule ─────────────────────────────────────────────────────────────────
 * Every ops route refuses by answering exactly as a route that was never mounted:
 * status 404, `text/plain; charset=UTF-8`, body `404 Not Found`, byte for byte.
 * That is deliberate — it is what stops a live Act-1 user from detecting the ops
 * plane by comparing responses — and it does not change here.
 *
 * What changes is what the CONSOLE does with it. This surface is founder-only
 * (opsFounderGate on the API, notFound() on the page), so the one person reading it
 * is the one person entitled to know that a refusal is a refusal. Before, the words
 * "404 Not Found" arrived under "Das hat nicht funktioniert" with no guidance, and
 * on 2026-08-08 that cost a whole founder window: every console button answered 404
 * because the action endpoints sat behind a different allowlist than the console
 * itself, and the console had no way to say so.
 *
 * ── What is deliberately NOT done ────────────────────────────────────────────
 * Guessing the cause. Two things produce this exact answer — the account is not on
 * the list for that route, or the hosting switch is off — and from out here they
 * are indistinguishable ON PURPOSE. So the hint names both and claims neither. A
 * console that picked the likelier one would be inventing the very kind of
 * explanation this phase exists to refuse.
 *
 * No stack traces, ever: the detail block carries the request line, the status and
 * the response body verbatim. That is the exchange itself — the thing worth pasting
 * into a report — and not a dump of this app's internals.
 */

import { STR, type Lang } from './strings';

/** An error the founder can act on: a sentence, plus the raw material to paste. */
export interface HonestError {
  message: string;
  detail: string;
  /** Set only for a refusal — "that did not work" is wrong for a deliberate answer. */
  title?: string;
  /** Set only for a refusal: what it means, without claiming which cause applied. */
  hint?: string;
}

/**
 * Is this the gate refusing, as opposed to a handler that ran and answered 404?
 *
 * The discriminator is the bytes, because the bytes are the whole contract: the
 * gate sends plain text `404 Not Found`, while a handler's 404 (an unknown E2E job,
 * a project that is not there) carries a JSON body with its own German sentence.
 * Anything that parsed as JSON therefore came from a handler — which means the
 * caller was ADMITTED, and calling that a refusal would be exactly backwards.
 */
export function isGateRefusal(status: number, raw: string, parsed: unknown): boolean {
  return status === 404 && parsed === null && raw.trim() === '404 Not Found';
}

/** `GET /api/ops/router → 404`, the first line of every detail block. */
export function whereLine(method: string | undefined, path: string): string {
  return `${method ?? 'GET'} ${path}`;
}

/**
 * A failed response, explained. `raw` is capped rather than summarised: the founder
 * is meant to paste it, and a summary of an error is not evidence of one.
 */
export function explainFailure(
  lang: Lang,
  where: string,
  status: number,
  raw: string,
  parsed: unknown,
): HonestError {
  const t = STR[lang].error;
  const detail = `${where} → ${status}\n${raw.slice(0, 4000)}`;

  if (isGateRefusal(status, raw, parsed)) {
    return { title: t.refusedTitle, message: t.refused, hint: t.refusedWhy, detail };
  }

  // Otherwise prefer the API's own sentence. It was written for this reader.
  const body = parsed as { message?: string; error?: string } | null;
  const message =
    body?.message ?? (status === 401 || status === 403 ? t.unauthorized : status === 404 ? t.notFound : t.generic);
  return { message, detail };
}

/** A request that never got an answer. `.message`, never a stack. */
export function explainNetworkFailure(lang: Lang, where: string, err: unknown): HonestError {
  return {
    message: STR[lang].error.network,
    detail: `${where}\n${(err as Error)?.message ?? String(err)}`,
  };
}
