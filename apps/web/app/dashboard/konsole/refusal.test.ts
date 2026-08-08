// AKT 2 · PHASE 2.5 · U-A3 — the console tells a refusal from a malfunction.
//
// The property under test is narrow and load-bearing: the ops routes refuse with
// Hono's byte-identical `404 Not Found` in plain text, and the console — which only
// the founder can see — must say what that MEANS instead of showing the four bare
// words. Equally load-bearing in the other direction: a 404 that came from a handler
// that actually RAN (an unknown E2E job, a project that is not there) must keep its
// own sentence, because calling that a refusal would tell the operator the exact
// opposite of what happened.
//
// And the thing this must never start doing: guessing which of the two possible
// causes applied. From the client they are indistinguishable by design.

import { describe, it, expect } from 'vitest';
import { explainFailure, explainNetworkFailure, isGateRefusal, whereLine } from './refusal';
import { STR } from './strings';

/** Exactly what middleware/ops-gate.ts and ops-founder-gate.ts put on the wire. */
const GATE_BODY = '404 Not Found';

describe('a gate refusal is recognised by the bytes it actually sends', () => {
  it('recognises the refusal', () => {
    expect(isGateRefusal(404, GATE_BODY, null)).toBe(true);
  });

  it('tolerates a trailing newline but nothing else', () => {
    expect(isGateRefusal(404, `${GATE_BODY}\n`, null)).toBe(true);
    expect(isGateRefusal(404, 'Not Found', null)).toBe(false);
    expect(isGateRefusal(404, '404 not found', null)).toBe(false);
  });

  it('does NOT call a handler`s own 404 a refusal — that handler ran', () => {
    const body = { error: 'unknown_job', message: 'Dieser Lauf ist diesem Server nicht bekannt.' };
    expect(isGateRefusal(404, JSON.stringify(body), body)).toBe(false);
  });

  it('does not call any other status a refusal', () => {
    for (const status of [200, 400, 401, 403, 409, 422, 500, 502, 503]) {
      expect(isGateRefusal(status, GATE_BODY, null), `status ${status}`).toBe(false);
    }
  });
});

describe('what the founder is told when an action is refused', () => {
  for (const lang of ['de', 'en'] as const) {
    describe(lang, () => {
      const t = STR[lang].error;
      const err = explainFailure(lang, 'POST /api/ops/router/provision', 404, GATE_BODY, null);

      it('names it a refusal rather than a malfunction', () => {
        expect(err.title).toBe(t.refusedTitle);
        expect(err.message).toBe(t.refused);
        expect(err.message).not.toBe(t.generic);
      });

      it('says what a refusal means, in this language', () => {
        expect(err.hint).toBe(t.refusedWhy);
        expect(err.hint!.length).toBeGreaterThan(40);
      });

      it('names BOTH possible causes and picks neither', () => {
        // The gate answers identically for both on purpose. A console that named
        // one would be inventing the half it cannot know.
        expect(err.hint).toContain('OPS_FOUNDER_ACCOUNTS');
        expect(err.hint).toContain('OPS_BETA_ACCOUNTS');
        expect(err.hint).toContain('OPS_HOSTING_ENABLED');
      });

      it('keeps the raw exchange, verbatim and copyable', () => {
        expect(err.detail).toBe(`POST /api/ops/router/provision → 404\n${GATE_BODY}`);
      });
    });
  }

  it('says nothing about tokens, sessions or values — only variable NAMES', () => {
    for (const lang of ['de', 'en'] as const) {
      const hint = STR[lang].error.refusedWhy;
      expect(hint).not.toMatch(/Bearer|token|Token|=\s*\S+@/);
    }
  });

  it('carries no stack trace — the detail is the exchange, not this app`s internals', () => {
    const err = explainFailure('de', 'GET /api/ops/router', 404, GATE_BODY, null);
    expect(err.detail).not.toMatch(/\bat\s+\w+.*\(.*:\d+:\d+\)/);
    expect(err.detail.split('\n')).toHaveLength(2);
  });
});

describe('everything that is NOT a refusal keeps its own answer', () => {
  it('prefers the API`s own German sentence whenever there is one', () => {
    const body = { error: 'scan_blocked', message: 'Der Scan hat die Veröffentlichung gestoppt.' };
    const err = explainFailure('de', 'POST /api/ops/apps/publish', 422, JSON.stringify(body), body);
    expect(err.message).toBe(body.message);
    expect(err.title).toBeUndefined();
    expect(err.hint).toBeUndefined();
  });

  it('keeps a handler`s JSON 404 as its own sentence, not as a refusal', () => {
    const body = { error: 'unknown_job', message: 'Dieser Lauf ist diesem Server nicht bekannt.' };
    const err = explainFailure('de', 'GET /api/ops-console/e2e/status/x', 404, JSON.stringify(body), body);
    expect(err.message).toBe(body.message);
    expect(err.title).toBeUndefined();
  });

  it('falls back to the session sentence on 401/403', () => {
    for (const status of [401, 403]) {
      expect(explainFailure('de', 'GET /x', status, '', null).message).toBe(STR.de.error.unauthorized);
    }
  });

  it('falls back to the generic sentence on a 5xx with no message', () => {
    expect(explainFailure('en', 'GET /x', 502, 'Bad Gateway', null).message).toBe(STR.en.error.generic);
  });

  it('caps a huge body instead of pasting a megabyte into the page', () => {
    const err = explainFailure('de', 'GET /x', 500, 'x'.repeat(10_000), null);
    expect(err.detail.length).toBeLessThan(4_200);
  });

  it('reports an unreachable API with the thrown message only', () => {
    const err = explainNetworkFailure('de', 'GET /api/ops/router', new TypeError('Failed to fetch'));
    expect(err.message).toBe(STR.de.error.network);
    expect(err.detail).toBe('GET /api/ops/router\nFailed to fetch');
    expect(err.hint).toBeUndefined();
  });
});

describe('the detail block always says which request it was', () => {
  it('defaults to GET when no method was given', () => {
    expect(whereLine(undefined, '/api/ops-console/projects')).toBe('GET /api/ops-console/projects');
  });

  it('keeps the method it was given', () => {
    expect(whereLine('DELETE', '/api/admin/ops/apps/x')).toBe('DELETE /api/admin/ops/apps/x');
  });
});
