// ACT 2 · PHASE 1 · U1.1 gate — the beta allowlist.
//
// Both dimensions are tested independently AND together: the global kill switch
// (OPS_HOSTING_ENABLED) and the per-account allowlist (OPS_BETA_ACCOUNTS). The
// property that matters most is fail-closed: every malformed, absent or partial
// configuration must deny, never admit.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isOpsBetaAccount,
  opsBetaDenyReason,
  opsBetaEmails,
  opsHostingEnabled,
} from './ops-beta';

const BETA = 'vinc.hafner3@gmail.com';
const COHORT = 'real.user@example.com';

function clearEnv() {
  delete process.env.OPS_HOSTING_ENABLED;
  delete process.env.OPS_BETA_ACCOUNTS;
}

beforeEach(clearEnv);
afterEach(clearEnv);

describe('dimension 1 — the global kill switch', () => {
  it('is OFF when unset (the production default)', () => {
    expect(opsHostingEnabled()).toBe(false);
  });

  it('is OFF for every value that is not exactly "true"', () => {
    for (const v of ['', 'false', 'FALSE', '0', '1', 'yes', 'on', 'True ish', 'null', 'undefined']) {
      process.env.OPS_HOSTING_ENABLED = v;
      expect(opsHostingEnabled(), `value ${JSON.stringify(v)} must not open the gate`).toBe(false);
    }
  });

  it('is ON for "true", case-insensitively and whitespace-tolerantly', () => {
    for (const v of ['true', 'TRUE', 'True', '  true  ']) {
      process.env.OPS_HOSTING_ENABLED = v;
      expect(opsHostingEnabled(), `value ${JSON.stringify(v)} must open the gate`).toBe(true);
    }
  });

  it('closes the gate for an allowlisted user when the switch is off', () => {
    process.env.OPS_BETA_ACCOUNTS = BETA;
    process.env.OPS_HOSTING_ENABLED = 'false';
    expect(isOpsBetaAccount(BETA)).toBe(false);
    expect(opsBetaDenyReason(BETA)).toBe('hosting_disabled');
  });

  it('closes the gate for an allowlisted user when the switch is unset', () => {
    process.env.OPS_BETA_ACCOUNTS = BETA;
    expect(isOpsBetaAccount(BETA)).toBe(false);
    expect(opsBetaDenyReason(BETA)).toBe('hosting_disabled');
  });
});

describe('dimension 2 — the per-account allowlist', () => {
  beforeEach(() => {
    process.env.OPS_HOSTING_ENABLED = 'true';
  });

  it('parses a comma-separated list, trimming and lower-casing', () => {
    process.env.OPS_BETA_ACCOUNTS = ' A@Example.com , b@example.com,,  C@EXAMPLE.COM  ';
    expect(opsBetaEmails()).toEqual(['a@example.com', 'b@example.com', 'c@example.com']);
  });

  it('is empty (admits nobody) when unset', () => {
    expect(opsBetaEmails()).toEqual([]);
    expect(isOpsBetaAccount(BETA)).toBe(false);
    expect(opsBetaDenyReason(BETA)).toBe('not_allowlisted');
  });

  it('admits an allowlisted email regardless of case or surrounding whitespace', () => {
    process.env.OPS_BETA_ACCOUNTS = BETA;
    expect(isOpsBetaAccount(BETA)).toBe(true);
    expect(isOpsBetaAccount('  VINC.Hafner3@Gmail.com ')).toBe(true);
    expect(opsBetaDenyReason(BETA)).toBeNull();
  });

  it('admits every entry of a multi-account list', () => {
    process.env.OPS_BETA_ACCOUNTS = `${BETA},vinc.hafner4@gmail.com`;
    expect(isOpsBetaAccount(BETA)).toBe(true);
    expect(isOpsBetaAccount('vinc.hafner4@gmail.com')).toBe(true);
  });

  it('refuses a live Act-1 cohort user even with the switch on', () => {
    process.env.OPS_BETA_ACCOUNTS = BETA;
    expect(isOpsBetaAccount(COHORT)).toBe(false);
    expect(opsBetaDenyReason(COHORT)).toBe('not_allowlisted');
  });

  it('does not admit on a substring or prefix match', () => {
    process.env.OPS_BETA_ACCOUNTS = BETA;
    for (const near of ['vinc.hafner3@gmail.com.evil.tld', 'xvinc.hafner3@gmail.com', 'vinc.hafner3@gmail.co', 'vinc.hafner3']) {
      expect(isOpsBetaAccount(near), `${near} must not be admitted`).toBe(false);
    }
  });
});

describe('subject shapes and fail-closed behaviour', () => {
  beforeEach(() => {
    process.env.OPS_HOSTING_ENABLED = 'true';
    process.env.OPS_BETA_ACCOUNTS = BETA;
  });

  it('accepts a bare email string or an object carrying one', () => {
    expect(isOpsBetaAccount(BETA)).toBe(true);
    expect(isOpsBetaAccount({ email: BETA })).toBe(true);
  });

  it('denies null, undefined, and an object with no usable email', () => {
    for (const subject of [null, undefined, {}, { email: null }, { email: '' }, { email: '   ' }, '']) {
      expect(isOpsBetaAccount(subject as never), `${JSON.stringify(subject)} must be denied`).toBe(false);
    }
    expect(opsBetaDenyReason(null)).toBe('no_email');
    expect(opsBetaDenyReason({ email: null })).toBe('no_email');
  });
});

describe('the two dimensions are ANDed — the truth table', () => {
  const rows: Array<{ flag: string | undefined; list: string | undefined; email: string; expected: boolean }> = [
    { flag: undefined, list: undefined, email: BETA, expected: false },
    { flag: undefined, list: BETA, email: BETA, expected: false },
    { flag: 'false', list: BETA, email: BETA, expected: false },
    { flag: 'true', list: undefined, email: BETA, expected: false },
    { flag: 'true', list: COHORT, email: BETA, expected: false },
    { flag: 'true', list: BETA, email: COHORT, expected: false },
    { flag: 'true', list: BETA, email: BETA, expected: true },
  ];

  it('admits in exactly one of the seven configurations', () => {
    const results = rows.map((r) => {
      clearEnv();
      if (r.flag !== undefined) process.env.OPS_HOSTING_ENABLED = r.flag;
      if (r.list !== undefined) process.env.OPS_BETA_ACCOUNTS = r.list;
      return isOpsBetaAccount(r.email);
    });
    expect(results).toEqual(rows.map((r) => r.expected));
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});

// ── The dashboard-paste shapes (FINDING-5) ───────────────────────────────────
//
// Same hardening as the founder allowlist, applied to BOTH of this gate's
// dimensions: the kill switch is a pasted value too, and a quoted `"true"` used to
// read as OFF — which would have taken the whole of Act 2 dark while the Railway
// dashboard showed a variable that plainly said true.
describe('the value as a human actually pastes it into Railway', () => {
  const ON_SHAPES = ['true', '"true"', "'true'", '  true  ', '"  true  "', 'TRUE', '"TRUE"', '\ntrue\n'];

  it.each(ON_SHAPES)('kill switch: %j opens the gate, exactly as a clean `true` does', (raw) => {
    process.env.OPS_HOSTING_ENABLED = raw;
    expect(opsHostingEnabled()).toBe(true);
  });

  it('kill switch: every non-true value is still OFF, quoted or not', () => {
    for (const raw of ['false', '"false"', "'false'", '1', '"1"', 'yes', '"yes"', '', '""', '   ']) {
      process.env.OPS_HOSTING_ENABLED = raw;
      expect(opsHostingEnabled()).toBe(false);
    }
  });

  const LIST_SHAPES: Array<[string, string]> = [
    ['plain', BETA],
    ['double-quoted', `"${BETA}"`],
    ['single-quoted', `'${BETA}'`],
    ['whitespace-padded', `   ${BETA}   `],
    ['trailing comma', `${BETA},`],
    ['mixed case', BETA.toUpperCase()],
    ['quoted, padded, mixed case, trailing comma', `  " ${BETA.toUpperCase()} , "  `],
  ];

  it.each(LIST_SHAPES)('allowlist: %s admits the beta account, exactly as the clean value does', (_label, raw) => {
    process.env.OPS_HOSTING_ENABLED = 'true';
    process.env.OPS_BETA_ACCOUNTS = raw;
    expect(opsBetaEmails()).toContain(BETA);
    expect(isOpsBetaAccount(BETA)).toBe(true);
    expect(opsBetaDenyReason(BETA)).toBeNull();
  });

  it.each(LIST_SHAPES)('allowlist: %s still refuses the cohort', (_label, raw) => {
    process.env.OPS_HOSTING_ENABLED = 'true';
    process.env.OPS_BETA_ACCOUNTS = raw;
    expect(isOpsBetaAccount(COHORT)).toBe(false);
  });

  it('a quote-only allowlist admits NOBODY even with the switch on', () => {
    process.env.OPS_HOSTING_ENABLED = 'true';
    for (const raw of ['""', "''", '"  "', '   ', ',']) {
      process.env.OPS_BETA_ACCOUNTS = raw;
      expect(opsBetaEmails()).toEqual([]);
      expect(isOpsBetaAccount(BETA)).toBe(false);
    }
  });
});
