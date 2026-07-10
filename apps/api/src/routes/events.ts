import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { trackEvent, type PlatformEventType } from '../lib/platform-events';

type Variables = { userId: string };
const events = new Hono<{ Variables: Variables }>();
events.use('*', authMiddleware);

// I1: the ONLY client-emittable event types. UI-surface signals that have no
// server-side truth-gate (a card being shown, a help panel opened). Everything
// on the money/verify path (publish_verified, upgraded, agent_run_finished, …)
// is emitted server-side from its truth-gate and is deliberately NOT here — a
// client must never be able to forge those.
const CLIENT_EMITTABLE = new Set<PlatformEventType>([
  'trial_card_shown',
  'trial_card_clicked',
  'help_opened',
  'feedback_submitted',
]);

// Metadata-only guard (WAVE-I privacy law): meta may carry only short scalar
// tags — which card, which page. Long strings (a smuggled message / file body)
// are dropped, and nested objects/arrays are rejected outright. This is enforced
// server-side so a hostile client cannot turn the event sink into a content log.
const MetaSchema = z
  .record(z.union([z.string().max(120), z.number(), z.boolean(), z.null()]))
  .optional();

const BodySchema = z.object({
  type: z.string().max(64),
  meta: MetaSchema,
});

// POST /api/events  { type, meta? }  → 204 always (fire-and-forget, never blocks UX)
events.post('/', async (c) => {
  const userId = c.get('userId');
  const parsed = BodySchema.safeParse(await c.req.json().catch(() => ({})));

  if (parsed.success && CLIENT_EMITTABLE.has(parsed.data.type as PlatformEventType)) {
    trackEvent({
      eventType: parsed.data.type as PlatformEventType,
      userId,
      meta: parsed.data.meta ?? {},
    });
  }
  // Unknown / non-whitelisted types are silently ignored — the endpoint never
  // errors, so a client emit can never surface as a user-visible failure.
  return c.body(null, 204);
});

export { events };
