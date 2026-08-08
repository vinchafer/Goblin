// AKT 2 · PHASE 2.5 · U-C1 — the founder allowlist.
//
// Two properties carry the whole unit and both are tested against, not for:
//   1. FAIL-CLOSED. Unset, empty, whitespace-only or malformed env admits NOBODY,
//      including the founder. An empty allowlist that admits everyone is the
//      classic inversion of this pattern; it must be impossible here.
//   2. INDEPENDENCE. Neither OPS_HOSTING_ENABLED nor OPS_BETA_ACCOUNTS may change
//      any answer. This is the Phase-2 finding that going dark must not disarm the
//      kill switch, re-verified rather than assumed.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isOpsFounderAccount,
  opsFounderConfigured,
  opsFounderDenyReason,
  opsFounderEmails,
} from './ops-founder';

const FOUNDER = 'vinc.hafner3@gmail.com';
const BETA_NOT_FOUNDER = 'beta.tester@example.com';
const COHORT = 'real.user@example.com';

function clearEnv() {
  delete process.env.OPS_FOUNDER_ACCOUNTS;
  delete process.env.OPS_BETA_ACCOUNTS;
  delete process.env.OPS_HOSTING_ENABLED;
}

beforeEach(clearEnv);
afterEach(clearEnv);

describe('the default is nobody', () => {
  it('admits nobody when the env var is unset — the founder included', () => {
    expect(opsFounderConfigured()).toBe(false);
    expect(isOpsFounderAccount(FOUNDER)).toBe(false);
    expect(opsFounderDenyReason(FOUNDER)).toBe('not_configured');
  });

  it('admits nobody for empty and whitespace-only values', () => {
    for (const v of ['', ' ', '   ', ',', ' , , ', '\t\n']) {
      process.env.OPS_FOUNDER_ACCOUNTS = v;
      expect(opsFounderEmails(), `value ${JSON.stringify(v)} must parse to no accounts`).toEqual([]);
      expect(isOpsFounderAccount(FOUNDER), `value ${JSON.stringify(v)} must admit nobody`).toBe(false);
    }
  });

  it('admits nobody without an email, whatever the allowlist says', () => {
    process.env.OPS_FOUNDER_ACCOUNTS = FOUNDER;
    for (const subject of [null, undefined, '', '   ', {}, { email: null }, { email: '' }]) {
      expect(isOpsFounderAccount(subject as never)).toBe(false);
    }
  });
});

describe('the allowlist itself', () => {
  it('admits the founder', () => {
    process.env.OPS_FOUNDER_ACCOUNTS = FOUNDER;
    expect(isOpsFounderAccount(FOUNDER)).toBe(true);
    expect(isOpsFounderAccount({ email: FOUNDER })).toBe(true);
    expect(opsFounderDenyReason(FOUNDER)).toBeNull();
  });

  it('is case- and whitespace-insensitive on both sides', () => {
    process.env.OPS_FOUNDER_ACCOUNTS = `  ${FOUNDER.toUpperCase()} , ${COHORT} `;
    expect(isOpsFounderAccount(FOUNDER)).toBe(true);
    expect(isOpsFounderAccount(`  ${FOUNDER}  `)).toBe(true);
    expect(isOpsFounderAccount(FOUNDER.toUpperCase())).toBe(true);
  });

  it('refuses anyone not on it', () => {
    process.env.OPS_FOUNDER_ACCOUNTS = FOUNDER;
    for (const who of [COHORT, BETA_NOT_FOUNDER, 'vinc.hafner3@gmail.com.evil.example']) {
      expect(isOpsFounderAccount(who), `${who} must be refused`).toBe(false);
      expect(opsFounderDenyReason(who)).toBe('not_allowlisted');
    }
  });

  it('does not match on a prefix, suffix or substring', () => {
    process.env.OPS_FOUNDER_ACCOUNTS = FOUNDER;
    for (const who of ['vinc.hafner3@gmail.co', 'xvinc.hafner3@gmail.com', 'vinc.hafner3@gmail.comx']) {
      expect(isOpsFounderAccount(who), `${who} must not match`).toBe(false);
    }
  });
});

describe('independence — going dark must not disarm the operator', () => {
  it('admits the founder with OPS_HOSTING_ENABLED off, unset and malformed', () => {
    process.env.OPS_FOUNDER_ACCOUNTS = FOUNDER;
    for (const v of [undefined, 'false', '', '0', 'yes']) {
      if (v === undefined) delete process.env.OPS_HOSTING_ENABLED;
      else process.env.OPS_HOSTING_ENABLED = v;
      expect(isOpsFounderAccount(FOUNDER), `hosting=${String(v)} must not change the answer`).toBe(true);
    }
  });

  it('does not consult OPS_BETA_ACCOUNTS in either direction', () => {
    // On the beta list but not the founder list → refused.
    process.env.OPS_BETA_ACCOUNTS = `${FOUNDER},${BETA_NOT_FOUNDER}`;
    process.env.OPS_FOUNDER_ACCOUNTS = FOUNDER;
    expect(isOpsFounderAccount(BETA_NOT_FOUNDER)).toBe(false);

    // On the founder list but NOT on the beta list → still admitted.
    process.env.OPS_BETA_ACCOUNTS = BETA_NOT_FOUNDER;
    expect(isOpsFounderAccount(FOUNDER)).toBe(true);

    // Beta list absent entirely → unchanged.
    delete process.env.OPS_BETA_ACCOUNTS;
    expect(isOpsFounderAccount(FOUNDER)).toBe(true);
  });

  it('stays closed when only the BETA list names the founder', () => {
    process.env.OPS_HOSTING_ENABLED = 'true';
    process.env.OPS_BETA_ACCOUNTS = FOUNDER;
    expect(isOpsFounderAccount(FOUNDER)).toBe(false);
    expect(opsFounderDenyReason(FOUNDER)).toBe('not_configured');
  });
});

// ── The dashboard-paste shapes (FINDING-5) ───────────────────────────────────
//
// The console 404'd for the one account it was armed for because the allowlist was
// read with a bare `.trim().toLowerCase()`: a value pasted with its quotes still on
// produced an entry that matched no email that would ever sign in. The gate was
// working exactly as designed — it was the parser that was wrong, and the failure
// was silent because a fail-closed gate has nothing to say.
//
// Each shape below is asserted to admit the founder EXACTLY as the clean value does.
// The negative direction is asserted alongside it: hardening the parser must not
// start admitting anyone else, and must not repair a value that is genuinely wrong.
describe('the value as a human actually pastes it into Railway', () => {
  const SHAPES: Array<[string, string]> = [
    ['plain', FOUNDER],
    ['double-quoted', `"${FOUNDER}"`],
    ['single-quoted', `'${FOUNDER}'`],
    ['whitespace-padded', `   ${FOUNDER}   `],
    ['newline-padded', `\n${FOUNDER}\n`],
    ['quoted AND padded', `  "${FOUNDER}"  `],
    ['trailing comma', `${FOUNDER},`],
    ['leading comma', `,${FOUNDER}`],
    ['mixed case', FOUNDER.toUpperCase()],
    ['quoted, padded, mixed case, trailing comma', `  " ${FOUNDER.toUpperCase()} , "  `],
  ];

  it.each(SHAPES)('%s admits the founder, exactly as the clean value does', (_label, raw) => {
    process.env.OPS_FOUNDER_ACCOUNTS = raw;
    expect(opsFounderEmails()).toContain(FOUNDER);
    expect(opsFounderConfigured()).toBe(true);
    expect(isOpsFounderAccount(FOUNDER)).toBe(true);
    expect(opsFounderDenyReason(FOUNDER)).toBeNull();
  });

  it.each(SHAPES)('%s still refuses everyone else', (_label, raw) => {
    process.env.OPS_FOUNDER_ACCOUNTS = raw;
    for (const who of [COHORT, BETA_NOT_FOUNDER, `x${FOUNDER}`, `${FOUNDER}.evil.example`]) {
      expect(isOpsFounderAccount(who)).toBe(false);
      expect(opsFounderDenyReason(who)).toBe('not_allowlisted');
    }
  });

  it('a multi-entry list survives every quoting style', () => {
    const SECOND = 'second.founder@example.com';
    for (const raw of [
      `${FOUNDER},${SECOND}`,
      `"${FOUNDER},${SECOND}"`,
      `'${FOUNDER},${SECOND}'`,
      `"${FOUNDER}","${SECOND}"`,
      `'${FOUNDER}','${SECOND}'`,
      ` ${FOUNDER} , ${SECOND} ,`,
    ]) {
      process.env.OPS_FOUNDER_ACCOUNTS = raw;
      expect(opsFounderEmails()).toEqual([FOUNDER, SECOND]);
      expect(isOpsFounderAccount(FOUNDER)).toBe(true);
      expect(isOpsFounderAccount(SECOND)).toBe(true);
      expect(isOpsFounderAccount(COHORT)).toBe(false);
    }
  });

  it('unwrapping never rescues a wrong address — fail-closed is preserved', () => {
    process.env.OPS_FOUNDER_ACCOUNTS = `"vinc.hafner9@gmail.com"`;
    expect(isOpsFounderAccount(FOUNDER)).toBe(false);
    expect(opsFounderDenyReason(FOUNDER)).toBe('not_allowlisted');
  });

  it('a quote-only or empty value still admits NOBODY', () => {
    for (const raw of ['""', "''", '"  "', '   ', ',', '""," "']) {
      process.env.OPS_FOUNDER_ACCOUNTS = raw;
      expect(opsFounderEmails()).toEqual([]);
      expect(opsFounderConfigured()).toBe(false);
      expect(isOpsFounderAccount(FOUNDER)).toBe(false);
      expect(opsFounderDenyReason(FOUNDER)).toBe('not_configured');
    }
  });
});
