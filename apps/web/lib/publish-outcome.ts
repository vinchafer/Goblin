/**
 * AKT 2 · PHASE 3 · C7 — what a hosted publish actually answered, decided in ONE place.
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * THE BUG THIS FILE EXISTS TO MAKE IMPOSSIBLE.
 *
 * `POST /api/ops/apps/publish` has four meaningfully different successful-ish
 * answers, and only one of them means the app is live:
 *
 *   200 { url, files, … }                     → live
 *   202 { status:'review', message, reviewId } → HELD. Nothing was uploaded.
 *   422 { error:'scan_blocked', message }      → refused by the deterministic rules
 *   503 { error:'review_unqueued', message }   → held, and we could not even record it
 *
 * The founder console read this with `if (response.ok)` and rendered "Live." — so a
 * publish that uploaded **nothing** was reported to the operator as live, with an
 * `<a href={undefined}>` beside it. That is the false-green anti-pattern, in the one
 * surface whose whole job is to tell the truth about production.
 *
 * The root cause was not the missing branch. It was that TWO components each
 * classified the response by hand, in their own vocabulary, so there was no single
 * place where "which outcome is this" could be got right once. The builder-facing
 * sheet happened to get it right; the console happened not to.
 *
 * ── The guard, and why it is shaped like this ────────────────────────────────
 * `classifyPublishOutcome` NEVER returns `live` by default. It returns `live` only
 * when it positively sees a non-empty `url` on a 2xx that did not say `review`.
 * Every answer it does not recognise — a new status, a renamed field, an empty
 * body, a future verdict nobody taught it about — falls to `unclear`, which the UI
 * renders as an honest "we do not know what happened, go and look".
 *
 * That is the difference between this and the code it replaces. The old code's
 * default was success. This one's default is doubt, so the next unanticipated
 * response shape cannot come back as a quiet "Live." — it comes back visibly wrong,
 * which is the only kind of wrong an operator surface may be.
 * ════════════════════════════════════════════════════════════════════════════════
 */

/** The verdicts the publish path can report, in the vocabulary both surfaces use. */
export type PublishOutcome =
  /** Live, at a URL the SERVER verified. Never a URL a client composed. */
  | { kind: 'live'; url: string; files?: number }
  /** Held by stage 2. Nothing uploaded. `message` is the API's own German. */
  | { kind: 'review'; message: string; reviewId?: string }
  /** Refused by the deterministic ruleset. `message` names the category, never the rule. */
  | { kind: 'refused'; message: string }
  /** Held, but the hold could not be recorded — so nobody is going to look at it. */
  | { kind: 'not_recorded'; message: string }
  /** A transport/gate failure, or an answer this function does not recognise. */
  | { kind: 'unclear'; message?: string };

/** The subset of the response body this classification depends on. */
export interface PublishResponseBody {
  url?: unknown;
  files?: unknown;
  status?: unknown;
  message?: unknown;
  error?: unknown;
  reviewId?: unknown;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

/**
 * Classify one publish response.
 *
 * Pure, so the honesty rule is testable without a browser — the same reason
 * `refusal.ts` exists as its own module rather than as a closure inside the
 * console component.
 *
 * NOTE ON ORDERING: `review` is checked BEFORE `url`, deliberately. If a future
 * response ever carried both, the hold is the fact that matters — the app is not
 * live, whatever else the payload says.
 */
export function classifyPublishOutcome(status: number, body: PublishResponseBody | null): PublishOutcome {
  const message = str(body?.message);

  // ── Held. 202 is the API's way of saying "accepted, and not finished". ──
  if (body?.status === 'review') {
    const reviewId = str(body?.reviewId);
    return { kind: 'review', message: message ?? '', ...(reviewId ? { reviewId } : {}) };
  }

  // ── Held, unrecorded. Its own kind because the promise differs: no human is
  //    waiting on this one, and the message says so. ──
  if (body?.error === 'review_unqueued') {
    return { kind: 'not_recorded', message: message ?? '' };
  }

  // ── Refused by the deterministic layer. A deliberate answer, not a malfunction,
  //    so it must not be rendered under "that did not work". The API sends the
  //    category in prose and no rule ids — see routes/ops.ts. ──
  if (body?.error === 'scan_blocked') {
    return { kind: 'refused', message: message ?? '' };
  }

  // ── Live. The ONLY positive branch, and it requires the server's own URL. ──
  if (status >= 200 && status < 300) {
    const url = str(body?.url);
    if (url) {
      const files = typeof body?.files === 'number' ? body.files : undefined;
      return { kind: 'live', url, ...(files !== undefined ? { files } : {}) };
    }
    // A 2xx with no URL and no verdict we know. NOT live — we cannot say what it is.
    return { kind: 'unclear', ...(message ? { message } : {}) };
  }

  return { kind: 'unclear', ...(message ? { message } : {}) };
}

/**
 * True when this outcome means an app is publicly reachable.
 *
 * Exists so no caller has to remember which kinds are "good". A caller that wants
 * to record a successful publish, refresh a list, or show a link asks this — and
 * gets `false` for every one of the four non-live answers.
 */
export function isLive(outcome: PublishOutcome): outcome is Extract<PublishOutcome, { kind: 'live' }> {
  return outcome.kind === 'live';
}
