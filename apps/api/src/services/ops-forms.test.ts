/**
 * AKT 2 · PHASE 4 · U4.3 + U4.6 — the ingest decision.
 *
 * This file is the evidence for the phase's sharpest promises, so it is organised
 * around them rather than around the functions:
 *
 *   • A missing Turnstile secret REFUSES. It never waves traffic through.
 *   • "We could not check" is never "you are a person" — every unknown fails
 *     closed, at every layer.
 *   • Over the cap the submission is REFUSED and said so. There is no branch in
 *     which a submission that did not land is reported as accepted.
 *   • Content never becomes a log line, an error message, or anything but a row.
 *   • An app can only ever be written through its OWN database id, and that id
 *     comes from the registry — never from the request. (U4.8's isolation proof.)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { OpsApp } from './ops-apps-store';

const {
  ingestSubmission,
  normalizeFields,
  sourceKey,
  formsEnabled,
  __resetRateLimiterForTest,
  MAX_FIELDS,
  MAX_FIELD_VALUE_CHARS,
} = await import('./ops-forms');

const APP: OpsApp = {
  appId: 'app-1',
  userId: 'user-1',
  projectId: 'proj-1',
  appName: 'meinladen',
  status: 'active',
  capsProfile: 'free-static',
  r2Prefix: 'apps/app-1/',
  routeKey: 'route:meinladen',
  workerScriptName: null,
  d1DatabaseId: 'db-meinladen',
  lastPublishedAt: null,
  createdAt: '2026-08-01T00:00:00Z',
};

const findApp = vi.fn();
const verify = vi.fn();
const accepted = vi.fn();
const insert = vi.fn();
const refuse = vi.fn();

const deps = () => ({
  findApp,
  verify,
  accepted,
  insert,
  refuse,
  appsDomain: () => 'justgoblin.app',
});

const input = (over: Partial<Parameters<typeof ingestSubmission>[0]> = {}) => ({
  appName: 'meinladen',
  formId: 'kontakt',
  origin: 'https://meinladen.justgoblin.app',
  token: 'a-real-token',
  fields: { name: 'Anna', nachricht: 'Hallo' },
  bodyBytes: 64,
  rateKey: `k-${Math.random()}`,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  __resetRateLimiterForTest();
  delete process.env.OPS_FORMS_ENABLED;
  findApp.mockResolvedValue(APP);
  verify.mockResolvedValue({ ok: true });
  accepted.mockResolvedValue(0);
  insert.mockResolvedValue({ ok: true, id: 'sub-1' });
  refuse.mockResolvedValue(undefined);
});

// ── the happy path, so the refusals below mean something ───────────────────

describe('a real submission', () => {
  it('is stored in the app’s OWN database and reported with the month’s standing', async () => {
    accepted.mockResolvedValue(11);
    const res = await ingestSubmission(input(), deps());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.submissionId).toBe('sub-1');
    expect(res.acceptedThisMonth).toBe(12);
    expect(res.monthlyCap).toBe(500);
    // THE ISOLATION ASSERTION. The database id is the registry row's, and there is
    // no path by which the request could have supplied a different one.
    expect(insert).toHaveBeenCalledWith('db-meinladen', expect.objectContaining({ formId: 'kontakt' }));
  });

  it('strips the Turnstile token — it is a credential, not a field somebody typed', async () => {
    await ingestSubmission(
      input({ fields: { name: 'Anna', 'cf-turnstile-response': 'tok', _goblin_token: 'tok' } }),
      deps(),
    );
    expect(insert).toHaveBeenCalledWith('db-meinladen', expect.objectContaining({ fields: { name: 'Anna' } }));
  });
});

// ── the app ─────────────────────────────────────────────────────────────────

describe('which apps this endpoint answers for at all', () => {
  it('an unknown name is unknown', async () => {
    findApp.mockResolvedValue(null);
    const res = await ingestSubmission(input(), deps());
    expect(res).toMatchObject({ ok: false, code: 'unknown_form', status: 404 });
  });

  it('a SUSPENDED app is byte-identically unknown — a visitor has no use for the difference, an abuser would', async () => {
    findApp.mockResolvedValue({ ...APP, status: 'suspended' });
    const res = await ingestSubmission(input(), deps());
    expect(res).toMatchObject({ ok: false, code: 'unknown_form', status: 404 });
  });

  it('an app with NO database — every app published before this phase — is unknown, not an error', async () => {
    findApp.mockResolvedValue({ ...APP, d1DatabaseId: null });
    const res = await ingestSubmission(input(), deps());
    expect(res).toMatchObject({ ok: false, code: 'unknown_form' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('the fleet kill switch closes the door honestly and touches nothing', async () => {
    process.env.OPS_FORMS_ENABLED = 'false';
    expect(formsEnabled()).toBe(false);
    const res = await ingestSubmission(input(), deps());
    expect(res).toMatchObject({ ok: false, code: 'forms_disabled', status: 503 });
    expect(findApp).not.toHaveBeenCalled();
  });

  it('unset means ON — a missing variable must not break every live form', () => {
    expect(formsEnabled()).toBe(true);
  });
});

describe('the origin must be the app’s own page', () => {
  it('refuses a submission from somewhere else entirely', async () => {
    const res = await ingestSubmission(input({ origin: 'https://boeswillig.example' }), deps());
    expect(res).toMatchObject({ ok: false, code: 'bad_origin', status: 403 });
    expect(verify).not.toHaveBeenCalled();
  });

  it('refuses a submission from ANOTHER Goblin app — the neighbour is not the owner', async () => {
    const res = await ingestSubmission(input({ origin: 'https://andereapp.justgoblin.app' }), deps());
    expect(res).toMatchObject({ ok: false, code: 'bad_origin' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('refuses a submission with no origin at all', async () => {
    const res = await ingestSubmission(input({ origin: null }), deps());
    expect(res).toMatchObject({ ok: false, code: 'bad_origin' });
  });
});

// ── shape and size ──────────────────────────────────────────────────────────

describe('shape and size, before anything external is asked', () => {
  it('refuses a body over the limit by its MEASURED length', async () => {
    const res = await ingestSubmission(input({ bodyBytes: 17 * 1024 }), deps());
    expect(res).toMatchObject({ ok: false, code: 'too_large', status: 413 });
    expect(verify).not.toHaveBeenCalled();
  });

  it('refuses an empty submission rather than thanking somebody for nothing', () => {
    expect(normalizeFields({})).toEqual({ ok: false, why: 'bad_shape' });
  });

  it('refuses nested objects — a form posts strings', () => {
    expect(normalizeFields({ a: { b: 1 } })).toEqual({ ok: false, why: 'bad_shape' });
  });

  it('refuses too many fields and over-long values', () => {
    const many = Object.fromEntries(Array.from({ length: MAX_FIELDS + 1 }, (_, i) => [`f${i}`, 'x']));
    expect(normalizeFields(many)).toEqual({ ok: false, why: 'too_large' });
    expect(normalizeFields({ a: 'x'.repeat(MAX_FIELD_VALUE_CHARS + 1) })).toEqual({ ok: false, why: 'too_large' });
  });

  it('keeps what somebody actually typed, unicode and all', () => {
    const r = normalizeFields({ name: 'Anna Müller', ' nachricht ': 'Grüße 🌱' });
    expect(r).toEqual({ ok: true, fields: { name: 'Anna Müller', nachricht: 'Grüße 🌱' } });
  });
});

// ── the rate limit ──────────────────────────────────────────────────────────

describe('the rate limit is independent of the app’s request budget', () => {
  it('stops a loop from one source before it costs a single Turnstile call', async () => {
    const key = 'one-source';
    for (let i = 0; i < 5; i += 1) {
      expect((await ingestSubmission(input({ rateKey: key }), deps())).ok).toBe(true);
    }
    const sixth = await ingestSubmission(input({ rateKey: key }), deps());
    expect(sixth).toMatchObject({ ok: false, code: 'rate_limited', status: 429 });
    // Five verifications for five accepted submissions — the sixth cost nothing.
    expect(verify).toHaveBeenCalledTimes(5);
  });

  it('the source key is opaque and does not contain the address that produced it', () => {
    const key = sourceKey('app-1', '203.0.113.7');
    expect(key).not.toContain('203.0.113');
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    // Stable within a process (so the limiter works) and scoped to the app.
    expect(sourceKey('app-1', '203.0.113.7')).toBe(key);
    expect(sourceKey('app-2', '203.0.113.7')).not.toBe(key);
  });
});

// ── Turnstile ───────────────────────────────────────────────────────────────

describe('Turnstile — and the rule that a missing secret refuses', () => {
  it('a missing secret REFUSES rather than accepting unverified traffic', async () => {
    verify.mockResolvedValue({ ok: false, code: 'not_configured', codes: [] });
    const res = await ingestSubmission(input(), deps());
    expect(res).toMatchObject({ ok: false, code: 'not_configured', status: 503 });
    expect(insert).not.toHaveBeenCalled();
  });

  it('a failed challenge is refused and nothing is stored', async () => {
    verify.mockResolvedValue({ ok: false, code: 'failed', codes: ['invalid-input-response'] });
    const res = await ingestSubmission(input(), deps());
    expect(res).toMatchObject({ ok: false, code: 'challenge_failed', status: 403 });
    expect(insert).not.toHaveBeenCalled();
  });

  it('an UNREACHABLE Turnstile fails CLOSED — an ingest a flood can switch off is not a gate', async () => {
    verify.mockResolvedValue({ ok: false, code: 'unavailable', codes: [] });
    const res = await ingestSubmission(input(), deps());
    expect(res).toMatchObject({ ok: false, code: 'challenge_unavailable', status: 503 });
    expect(insert).not.toHaveBeenCalled();
  });
});

// ── the cap (P4-b, P4-c) ────────────────────────────────────────────────────

describe('the monthly cap', () => {
  it('accepts right up to the ceiling', async () => {
    accepted.mockResolvedValue(499);
    expect((await ingestSubmission(input(), deps())).ok).toBe(true);
  });

  it('REFUSES at the ceiling — refused, never accepted-and-discarded', async () => {
    accepted.mockResolvedValue(500);
    const res = await ingestSubmission(input(), deps());
    expect(res).toMatchObject({ ok: false, code: 'over_cap', status: 429 });
    expect(insert).not.toHaveBeenCalled();
    // The app rides along, because the OWNER has to be told (U4.5).
    expect((res as { app?: OpsApp }).app?.appId).toBe('app-1');
  });

  it('counts the refusal, so "we turned people away" is a number and not a feeling', async () => {
    accepted.mockResolvedValue(500);
    await ingestSubmission(input(), deps());
    expect(refuse).toHaveBeenCalledWith('db-meinladen', expect.stringMatching(/^\d{4}-\d{2}$/));
  });

  it('a counter that cannot be READ refuses too — a cap that stops existing under load is not a cap', async () => {
    accepted.mockResolvedValue(null);
    const res = await ingestSubmission(input(), deps());
    expect(res).toMatchObject({ ok: false, code: 'cap_unknown', status: 503 });
    expect(insert).not.toHaveBeenCalled();
  });

  it('an unknown caps profile falls back to the DEFAULT ceiling, never to unlimited', async () => {
    findApp.mockResolvedValue({ ...APP, capsProfile: 'tippfehler' });
    accepted.mockResolvedValue(500);
    const res = await ingestSubmission(input(), deps());
    expect(res).toMatchObject({ ok: false, code: 'over_cap' });
  });
});

// ── the storage failure ─────────────────────────────────────────────────────

describe('a submission that did not land is never reported as accepted', () => {
  it('a failed insert is a refusal with its own honest code', async () => {
    insert.mockResolvedValue({ ok: false, detail: 'd1:query: the statement did not succeed' });
    const res = await ingestSubmission(input(), deps());
    expect(res).toMatchObject({ ok: false, code: 'storage_failed', status: 503 });
  });

  it('an insert that returns no id is a failure, not a success with a missing field', async () => {
    insert.mockResolvedValue({ ok: true });
    const res = await ingestSubmission(input(), deps());
    expect(res).toMatchObject({ ok: false, code: 'storage_failed' });
  });
});

// ── the content rule ────────────────────────────────────────────────────────

describe('no submission content leaves this module except into that app’s database', () => {
  it('nothing a visitor typed appears in the RESULT of any refusal', async () => {
    const secret = 'anna.mueller@example.com';
    const cases: Array<() => void> = [
      () => verify.mockResolvedValue({ ok: false, code: 'failed', codes: [] }),
      () => accepted.mockResolvedValue(500),
      () => insert.mockResolvedValue({ ok: false, detail: 'nope' }),
      () => findApp.mockResolvedValue(null),
    ];
    for (const arrange of cases) {
      vi.clearAllMocks();
      __resetRateLimiterForTest();
      findApp.mockResolvedValue(APP);
      verify.mockResolvedValue({ ok: true });
      accepted.mockResolvedValue(0);
      insert.mockResolvedValue({ ok: true, id: 'x' });
      arrange();
      const res = await ingestSubmission(input({ fields: { email: secret } }), deps());
      expect(res.ok).toBe(false);
      expect(JSON.stringify(res)).not.toContain(secret);
    }
  });
});
