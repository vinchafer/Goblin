// AKT 2 · PHASE 3 · U3.2 gate — "code tolerant to the table's absence", again.
//
// Migration 0102 is authored, not applied. These tests drive the queue against both
// database states. The property that matters most is the one where this file
// DIFFERS from the audit writer: an unrecordable hold answers null so the publish
// path can stop promising a human, instead of degrading quietly to "written".

import { describe, it, expect } from 'vitest';
import {
  decideReview,
  enqueueReview,
  findReviewItem,
  listNeedsAttentionReviews,
  listPendingReviews,
  listRecentReviewDecisions,
  markPublishFailed,
  markPublishRecovered,
  opsReviewQueueAvailable,
} from './ops-review-queue';

type QueryResult = { data?: unknown; error?: { code?: string; message?: string } | null };

/** The same minimal Supabase double the 0099 store tests use. */
function fakeSb(results: QueryResult[]) {
  const calls: string[] = [];
  let i = 0;
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'insert', 'update', 'eq', 'neq', 'order', 'limit', 'single', 'maybeSingle']) {
    builder[m] = (...args: unknown[]) => {
      calls.push(`${m}(${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(',')})`);
      return builder;
    };
  }
  (builder as { then: unknown }).then = (resolve: (v: QueryResult) => unknown) =>
    Promise.resolve(results[Math.min(i++, results.length - 1)] ?? { data: null, error: null }).then(resolve);
  return { sb: { from: (t: string) => (calls.push(`from(${t})`), builder) } as never, calls };
}

const ABSENT = { data: null, error: { code: '42P01', message: 'relation "ops_review_queue" does not exist' } };
const ABSENT_PGRST = { data: null, error: { code: 'PGRST205', message: 'Could not find the table in the schema cache' } };
const PRESENT = { data: [], error: null };

const ROW = {
  id: 'r1',
  user_id: 'u1',
  project_id: 'p1',
  requested_name: 'meinladen',
  status: 'pending',
  stage1_verdict: 'pass',
  stage1_rule_ids: [],
  stage2_verdict: 'review',
  stage2_reason: 'flagged',
  categories: ['deception'],
  stage2_confidence: 'medium',
  scanned_files: 3,
  scanned_bytes: 2048,
  tokens_input: 700,
  tokens_output: 18,
  decided_by: null,
  decided_at: null,
  decision_reason: null,
  created_at: '2026-08-13T00:00:00.000Z',
};

const INPUT = {
  userId: 'u1', projectId: 'p1', requestedName: 'meinladen',
  stage1Verdict: 'pass', stage1RuleIds: [],
  stage2Reason: 'flagged' as const, categories: ['deception' as const],
  stage2Confidence: 'medium', scannedFiles: 3, scannedBytes: 2048,
  tokensInput: 700, tokensOutput: 18,
};

describe('pre-migration (0102 not applied)', () => {
  it('detects the table as absent from either absence signature', async () => {
    for (const absent of [ABSENT, ABSENT_PGRST]) {
      const { sb } = fakeSb([absent]);
      expect(await opsReviewQueueAvailable(sb)).toBe(false);
    }
  });

  it('answers null on enqueue instead of throwing OR pretending', async () => {
    const { sb } = fakeSb([ABSENT]);
    await expect(enqueueReview(INPUT, sb)).resolves.toBeNull();
  });

  it('reports the queue as UNAVAILABLE rather than as empty', async () => {
    const { sb } = fakeSb([ABSENT]);
    // "nothing is waiting" and "nobody can see what is waiting" are different facts.
    await expect(listPendingReviews(sb)).resolves.toEqual({ available: false, items: [] });
  });

  it('cannot decide what it cannot see', async () => {
    const { sb } = fakeSb([ABSENT]);
    await expect(decideReview('r1', 'approved', 'founder@example.com', null, sb)).resolves.toBeNull();
  });

  it('reports the DECISION trail as unavailable rather than as "nothing decided"', async () => {
    const { sb } = fakeSb([ABSENT]);
    await expect(listRecentReviewDecisions(sb)).resolves.toEqual({ available: false, items: [] });
  });
});

describe('a transport error is not "not migrated"', () => {
  it('treats an unrecognised error as "the table exists, something else broke"', async () => {
    const { sb } = fakeSb([{ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }]);
    expect(await opsReviewQueueAvailable(sb)).toBe(true);
  });
});

describe('post-migration', () => {
  it('inserts a pending row and maps it back', async () => {
    const { sb, calls } = fakeSb([PRESENT, { data: ROW, error: null }]);
    const item = await enqueueReview(INPUT, sb);
    expect(item).toMatchObject({
      id: 'r1', status: 'pending', stage2Reason: 'flagged', categories: ['deception'],
      requestedName: 'meinladen', tokensInput: 700,
    });
    // The row records BOTH verdicts, not just the one that held it.
    expect(calls.join('|')).toContain('"stage1_verdict":"pass"');
    expect(calls.join('|')).toContain('"stage2_verdict":"review"');
  });

  it('answers null when the insert itself fails — still not a silent success', async () => {
    const { sb } = fakeSb([PRESENT, { data: null, error: { code: '23503', message: 'fk violation' } }]);
    await expect(enqueueReview(INPUT, sb)).resolves.toBeNull();
  });

  it('lists only pending rows, newest first', async () => {
    const { sb, calls } = fakeSb([PRESENT, { data: [ROW], error: null }]);
    const r = await listPendingReviews(sb);
    expect(r.available).toBe(true);
    expect(r.items).toHaveLength(1);
    expect(calls.join('|')).toContain('eq(status,pending)');
    expect(calls.join('|')).toContain('order(created_at');
  });

  it('finds one item by id', async () => {
    const { sb } = fakeSb([PRESENT, { data: ROW, error: null }]);
    await expect(findReviewItem('r1', sb)).resolves.toMatchObject({ id: 'r1' });
  });

  it('settles a decision with the actor and guards on status=pending', async () => {
    const { sb, calls } = fakeSb([PRESENT, { data: { ...ROW, status: 'blocked', decided_by: 'founder@example.com', decision_reason: 'Fake-Shop' }, error: null }]);
    const item = await decideReview('r1', 'blocked', 'founder@example.com', 'Fake-Shop', sb);
    expect(item).toMatchObject({ status: 'blocked', decidedBy: 'founder@example.com', decisionReason: 'Fake-Shop' });
    // Two console tabs must not both report success on the same item.
    expect(calls.join('|')).toContain('eq(status,pending)');
  });

  it('answers null when the row was already settled by someone else', async () => {
    const { sb } = fakeSb([PRESENT, { data: null, error: null }]);
    await expect(decideReview('r1', 'approved', 'founder@example.com', null, sb)).resolves.toBeNull();
  });
});

// ── C8: the decision trail, readable without SQL ────────────────────────────

describe('the decision trail', () => {
  const DECIDED = {
    ...ROW,
    status: 'blocked',
    decided_by: 'founder@example.com',
    decided_at: '2026-08-13T09:00:00.000Z',
    decision_reason: 'Fake-Shop',
  };

  it('lists settled rows only, newest decision first', async () => {
    const { sb, calls } = fakeSb([PRESENT, { data: [DECIDED], error: null }]);
    const r = await listRecentReviewDecisions(sb);
    expect(r.available).toBe(true);
    expect(r.items).toHaveLength(1);
    // Pending items belong in the OTHER list; a queue that mixed them would make
    // "waiting on you" and "already handled" look the same at a glance.
    expect(calls.join('|')).toContain('neq(status,pending)');
    expect(calls.join('|')).toContain('order(decided_at');
  });

  it('carries who, when and why — the four facts the founder needed SQL for', async () => {
    const { sb } = fakeSb([PRESENT, { data: [DECIDED], error: null }]);
    const [item] = (await listRecentReviewDecisions(sb)).items;
    expect(item).toMatchObject({
      requestedName: 'meinladen',
      status: 'blocked',
      decidedBy: 'founder@example.com',
      decidedAt: '2026-08-13T09:00:00.000Z',
      decisionReason: 'Fake-Shop',
    });
  });

  it('treats a failed read as unavailable, not as an empty trail', async () => {
    const { sb } = fakeSb([PRESENT, { data: null, error: { code: '57014', message: 'timeout' } }]);
    await expect(listRecentReviewDecisions(sb)).resolves.toEqual({ available: false, items: [] });
  });
});

// ── FOUNDER-WALK-6 · U3 (F3) — an approval whose publish then failed ───────

describe('markPublishFailed / markPublishRecovered / listNeedsAttentionReviews', () => {
  const FAILED_ROW = { ...ROW, status: 'approved_publish_failed', decided_by: 'founder@example.com', publish_failure_message: 'Dieser Name ist vergeben.' };
  const RECOVERED_ROW = { ...ROW, status: 'approved', decided_by: 'founder@example.com', publish_failure_message: null };

  it('markPublishFailed moves an approved row to the failed status, guarded on status=approved', async () => {
    const { sb, calls } = fakeSb([PRESENT, { data: FAILED_ROW, error: null }]);
    const item = await markPublishFailed('r1', 'Dieser Name ist vergeben.', sb);
    expect(item).toMatchObject({ status: 'approved_publish_failed', publishFailureMessage: 'Dieser Name ist vergeben.' });
    expect(calls.join('|')).toContain('eq(status,approved)');
  });

  it('markPublishFailed on a database WITHOUT 0104 still moves the status — the message is lost, not the fix', async () => {
    const { sb } = fakeSb([
      PRESENT, // table available
      { data: null, error: { code: '42703', message: 'column ops_review_queue.publish_failure_message does not exist' } }, // column missing
      { data: { ...ROW, status: 'approved_publish_failed' }, error: null }, // fallback without the column
    ]);
    const item = await markPublishFailed('r1', 'Dieser Name ist vergeben.', sb);
    expect(item).toMatchObject({ status: 'approved_publish_failed', publishFailureMessage: null });
  });

  it('markPublishFailed answers null when the table itself is absent', async () => {
    const { sb } = fakeSb([ABSENT]);
    await expect(markPublishFailed('r1', 'x', sb)).resolves.toBeNull();
  });

  it('markPublishRecovered returns a retried row to approved and clears the message', async () => {
    const { sb, calls } = fakeSb([PRESENT, { data: RECOVERED_ROW, error: null }]);
    const item = await markPublishRecovered('r1', sb);
    expect(item).toMatchObject({ status: 'approved', publishFailureMessage: null });
    expect(calls.join('|')).toContain('eq(status,approved_publish_failed)');
  });

  it('markPublishRecovered on a database WITHOUT 0104 still moves the status back', async () => {
    const { sb } = fakeSb([
      PRESENT,
      { data: null, error: { code: '42703', message: 'column ops_review_queue.publish_failure_message does not exist' } },
      { data: { ...ROW, status: 'approved' }, error: null },
    ]);
    const item = await markPublishRecovered('r1', sb);
    expect(item).toMatchObject({ status: 'approved' });
  });

  it('listNeedsAttentionReviews lists only the stranded rows', async () => {
    const { sb, calls } = fakeSb([PRESENT, { data: [FAILED_ROW], error: null }]);
    const r = await listNeedsAttentionReviews(sb);
    expect(r.available).toBe(true);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ publishFailureMessage: 'Dieser Name ist vergeben.' });
    expect(calls.join('|')).toContain('eq(status,approved_publish_failed)');
  });

  it('listNeedsAttentionReviews degrades to the base columns pre-0104, never throws', async () => {
    const { sb } = fakeSb([
      PRESENT,
      { data: null, error: { code: '42703', message: 'column ops_review_queue.publish_failure_message does not exist' } },
      { data: [ROW], error: null },
    ]);
    const r = await listNeedsAttentionReviews(sb);
    expect(r.available).toBe(true);
    expect(r.items[0]?.publishFailureMessage).toBeNull();
  });

  it('listNeedsAttentionReviews reports UNAVAILABLE, not empty, when the table is absent', async () => {
    const { sb } = fakeSb([ABSENT]);
    await expect(listNeedsAttentionReviews(sb)).resolves.toEqual({ available: false, items: [] });
  });
});
