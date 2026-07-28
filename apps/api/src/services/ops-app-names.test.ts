/**
 * AKT 2 · PHASE 2 · U2.4 — the name claim, and the one duplication in this phase.
 *
 * The reserved list exists twice: here, and inside the router Worker (which runs on
 * Cloudflare and cannot import from this package). A name added here but not there
 * would be claimable and would then serve a user's app on an operational hostname.
 * The first test in this file is the thing that makes that impossible to do by
 * accident — it parses the Worker's own source and compares the two lists.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  RESERVED_NAMES,
  appHostname,
  appUrl,
  checkNameShape,
  normalizeName,
} from './ops-app-names';

describe('the reserved list cannot drift from the router`s copy', () => {
  it('is identical to RESERVED in the Worker source', () => {
    const workerSrc = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'ops-router', 'worker.js'),
      'utf8',
    );
    const block = /const RESERVED = new Set\(\[([\s\S]*?)\]\)/.exec(workerSrc);
    expect(block, 'RESERVED not found in worker.js — did the declaration change shape?').toBeTruthy();
    const inWorker = [...block![1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);

    expect(inWorker.sort()).toEqual([...RESERVED_NAMES].sort());
  });

  it('protects the names the AUP publishes as reporting paths', () => {
    // These are load-bearing: the policy page tells people to use them.
    for (const name of ['abuse', 'support', 'security', 'legal']) {
      expect(RESERVED_NAMES).toContain(name);
    }
  });

  it('protects mail delivery even though no mail is served today', () => {
    for (const name of ['mail', 'smtp', 'imap', 'mx']) expect(RESERVED_NAMES).toContain(name);
  });
});

describe('normalisation', () => {
  it('lower-cases and trims — hostnames are case-insensitive', () => {
    expect(normalizeName('  MeinLaden  ')).toBe('meinladen');
  });

  it('treats a differently-cased name as the same claim', () => {
    // Otherwise "MeinLaden" and "meinladen" would be two rows fighting over one
    // hostname, and which one the router served would be a coin toss.
    expect(checkNameShape('MEINLADEN').normalized).toBe(checkNameShape('meinladen').normalized);
  });
});

describe('shape rules — every rejection names its own reason', () => {
  const cases: Array<[string, string | null]> = [
    ['meinladen', null],
    ['a1', 'too_short'],
    ['ab', 'too_short'],
    ['abc', null],
    ['a'.repeat(64), 'too_long'],
    ['a'.repeat(63), null],
    ['-meinladen', 'bad_shape'],
    ['meinladen-', 'bad_shape'],
    ['mein laden', 'bad_shape'],
    ['mein_laden', 'bad_shape'],
    ['mein.laden', 'bad_shape'],
    ['MeinLaden', null], // normalised first
    ['xn--mnchen-3ya', 'punycode'],
    ['admin', 'reserved'],
    ['support', 'reserved'],
    ['mein-laden-2026', null],
  ];

  for (const [input, reason] of cases) {
    it(`${JSON.stringify(input.length > 20 ? `${input.slice(0, 12)}…(${input.length})` : input)} → ${reason ?? 'ok'}`, () => {
      const r = checkNameShape(input);
      expect(r.ok).toBe(reason === null);
      if (reason) {
        expect(r.reason).toBe(reason);
        expect(r.message).toBeTruthy();
      }
    });
  }

  it('gives a DIFFERENT message for each kind of problem', () => {
    const messages = ['ab', '-x-', 'xn--test', 'admin'].map((n) => checkNameShape(n).message);
    expect(new Set(messages).size).toBe(4);
  });

  it('refuses punycode outright rather than half-understanding it', () => {
    // Punycode is how a homoglyph attack ships.
    expect(checkNameShape('xn--goblin-8sa').reason).toBe('punycode');
  });

  it('agrees with migration 0099`s CHECK constraints', () => {
    // If these disagreed, a name accepted here would fail the insert with an error
    // nobody could act on.
    const dbRe = /^[a-z0-9]([a-z0-9-]{1,61})[a-z0-9]$/;
    for (const name of ['abc', 'mein-laden', 'a'.repeat(63), 'x1y']) {
      expect(checkNameShape(name).ok).toBe(true);
      expect(dbRe.test(name)).toBe(true);
    }
    for (const name of ['ab', '-abc', 'abc-']) {
      expect(checkNameShape(name).ok).toBe(false);
      expect(dbRe.test(name)).toBe(false);
    }
  });
});

describe('URL composition', () => {
  it('builds the hostname and URL in exactly one place', () => {
    expect(appHostname('MeinLaden', 'justgoblin.app')).toBe('meinladen.justgoblin.app');
    expect(appUrl('meinladen', 'justgoblin.app')).toBe('https://meinladen.justgoblin.app');
  });
});
