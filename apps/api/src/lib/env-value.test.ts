/**
 * The parser hardening, pinned.
 *
 * The property every case below asserts is the same one: **a value a human plainly
 * meant to set reads the same as the clean value.** That is the whole point. The
 * founder console 404'd for its one account because `OPS_FOUNDER_ACCOUNTS` was read
 * with a bare `.trim().toLowerCase()`, so a pasted `"someone@example.com"` kept its
 * quotes and matched nothing — a fail-closed gate refusing the person it was armed
 * for, silently.
 *
 * The complementary property matters just as much and is asserted too: hardening the
 * parser must NOT widen what counts as `true`, and must NOT rescue a value that is
 * genuinely wrong. Fail-closed stays fail-closed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unwrapEnv, envString, envFlag, envList, splitEnvList } from './env-value';

const VAR = 'GOBLIN_ENV_VALUE_TEST_VAR';

const OLD = { ...process.env };
beforeEach(() => { delete process.env[VAR]; });
afterEach(() => { process.env = { ...OLD }; });

describe('unwrapEnv — the wrappers a dashboard paste brings with it', () => {
  it('returns the clean value untouched', () => {
    expect(unwrapEnv('a@example.com')).toBe('a@example.com');
  });

  it('strips surrounding whitespace, newlines and NBSP', () => {
    for (const raw of ['  a@example.com  ', '\na@example.com\n', '\ta@example.com\r\n', ' a@example.com ']) {
      expect(unwrapEnv(raw)).toBe('a@example.com');
    }
  });

  it('strips one pair of double quotes, and one pair of single quotes', () => {
    expect(unwrapEnv('"a@example.com"')).toBe('a@example.com');
    expect(unwrapEnv("'a@example.com'")).toBe('a@example.com');
  });

  it('strips quotes and whitespace together, in either order', () => {
    expect(unwrapEnv('  "a@example.com"  ')).toBe('a@example.com');
    expect(unwrapEnv('" a@example.com "')).toBe('a@example.com');
    expect(unwrapEnv("  ' a@example.com '  ")).toBe('a@example.com');
  });

  it('strips ONE pair only — a doubled quote is a different mistake and stays visible', () => {
    expect(unwrapEnv('""a@example.com""')).toBe('"a@example.com"');
  });

  it('leaves an unmatched or interior quote alone', () => {
    expect(unwrapEnv('"a@example.com')).toBe('"a@example.com');
    expect(unwrapEnv('a@example.com"')).toBe('a@example.com"');
    expect(unwrapEnv('\'a@example.com"')).toBe('\'a@example.com"');
    expect(unwrapEnv('a"b@example.com')).toBe('a"b@example.com');
  });

  it('handles unset, empty and quote-only values without throwing', () => {
    expect(unwrapEnv(undefined)).toBe('');
    expect(unwrapEnv(null)).toBe('');
    expect(unwrapEnv('')).toBe('');
    expect(unwrapEnv('   ')).toBe('');
    expect(unwrapEnv('""')).toBe('');
    expect(unwrapEnv('"')).toBe('"');
  });
});

describe('envFlag — every form of "on" the founder could have typed', () => {
  const ON = ['true', '"true"', "'true'", '  true  ', '"  true  "', 'TRUE', '"TRUE"', 'True', '\ntrue\n'];

  it.each(ON)('reads %j as on — the same as the clean value', (raw) => {
    process.env[VAR] = raw;
    expect(envFlag(VAR)).toBe(true);
  });

  it('is off for unset, empty and every non-true value — quoted or not', () => {
    expect(envFlag(VAR)).toBe(false);
    for (const raw of ['', '   ', 'false', '"false"', '1', '"1"', 'yes', '"yes"', 'on', 'truthy', '""']) {
      process.env[VAR] = raw;
      expect(envFlag(VAR)).toBe(false);
    }
  });

  it('does NOT widen the vocabulary — a quoted "1" is still off, exactly as a bare 1 is', () => {
    process.env[VAR] = '1';
    const bare = envFlag(VAR);
    process.env[VAR] = '"1"';
    expect(envFlag(VAR)).toBe(bare);
    expect(bare).toBe(false);
  });
});

describe('envList — the six paste shapes, each equal to the clean value', () => {
  const CLEAN = 'a@example.com,b@example.com';
  const EXPECTED = ['a@example.com', 'b@example.com'];

  const SHAPES: Array<[string, string]> = [
    ['plain', CLEAN],
    ['double-quoted whole value', `"${CLEAN}"`],
    ['single-quoted whole value', `'${CLEAN}'`],
    ['whitespace-padded', `   ${CLEAN}   `],
    ['newline-padded (the shell heredoc paste)', `\n${CLEAN}\n`],
    ['trailing comma', `${CLEAN},`],
    ['leading comma', `,${CLEAN}`],
    ['spaces around each entry', ' a@example.com , b@example.com '],
    ['mixed case', 'A@Example.COM,B@EXAMPLE.com'],
    ['each entry quoted', '"a@example.com","b@example.com"'],
    ['each entry single-quoted', "'a@example.com','b@example.com'"],
    ['quoted whole value AND padded entries', '" a@example.com , b@example.com "'],
    ['everything at once', `  "  A@Example.COM ,  'b@EXAMPLE.com'  ,  "  `],
  ];

  it.each(SHAPES)('%s', (_label, raw) => {
    process.env[VAR] = raw;
    expect(envList(VAR)).toEqual(EXPECTED);
  });

  it('is empty for unset, empty, whitespace and quote-only values — the fail-closed direction', () => {
    expect(envList(VAR)).toEqual([]);
    for (const raw of ['', '   ', '""', "''", ',', ',,,', '"  "']) {
      process.env[VAR] = raw;
      expect(envList(VAR)).toEqual([]);
    }
  });

  it('does not repair a genuinely wrong address — only wrappers are removed', () => {
    process.env[VAR] = '"a@example.co"';
    expect(envList(VAR)).toEqual(['a@example.co']);
    expect(envList(VAR)).not.toContain('a@example.com');
  });

  it('splitEnvList applies the same normalization to an already-joined string', () => {
    expect(splitEnvList('" A@Example.COM ",b@EXAMPLE.com,')).toEqual(EXPECTED);
  });
});

describe('envString', () => {
  it('unwraps, and answers "" rather than undefined when unset', () => {
    expect(envString(VAR)).toBe('');
    process.env[VAR] = '  "founder@example.com"  ';
    expect(envString(VAR)).toBe('founder@example.com');
  });

  it('does not lower-case — a value may be case-sensitive (a token, a URL path)', () => {
    process.env[VAR] = '"MixedCaseToken"';
    expect(envString(VAR)).toBe('MixedCaseToken');
  });
});
