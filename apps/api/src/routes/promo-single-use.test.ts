/**
 * FINAL-POLISH · U2 — "einmal einlösbar, wirklich" (the founder: "das ist wichtig!!").
 *
 * The founder entered his invite code at signup, was shown the plan/trial dialog anyway,
 * pasted the SAME code there, and it went through — which would mean single-use is broken.
 *
 * This file proves the property in the two places a secretless test can reach:
 *
 *  1. STRUCTURALLY, against the committed migration. Single-use is enforced by one
 *     conditional UPDATE inside `redeem_promo_code()`; only the first caller can satisfy
 *     `redeemed_by is null`. No JS test can prove Postgres's atomicity — what it CAN do
 *     is prove the guard is still shaped that way and that the grant is unreachable
 *     without a successful claim. Same approach as rls-policies.security.test.ts.
 *
 *  2. BEHAVIOURALLY, at the route, against a stand-in that implements the SQL's contract:
 *     cross-account refusal, same-account refusal, and a 20-way concurrent stampede in
 *     which exactly one caller may win.
 *
 * NOTE for the record (Gesetz 10, repo over prompt): the wave prompt refers to "the
 * existing 20-way race test". No such test existed in this checkout — `promo-code.test.ts`
 * covered code shape and copy only. The concurrency case below is new here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MIGRATION = readFileSync(
  fileURLToPath(new URL('../../../../supabase/migrations/0098_promo_codes.sql', import.meta.url)),
  'utf8',
);

// ─── 1) The guarantee, as it is written in the migration ──────────────────────
describe('0098 — the single-use guard is structural', () => {
  it('claims the code with a conditional UPDATE only an unredeemed row can satisfy', () => {
    // `redeemed_by is null` is the whole mechanism: the second caller updates 0 rows.
    expect(MIGRATION).toMatch(
      /update\s+public\.promo_codes[\s\S]*?set\s+redeemed_by\s*=\s*p_user[\s\S]*?where\s+code\s*=\s*v_code\s+and\s+redeemed_by\s+is\s+null\s+and\s+revoked\s*=\s*false/i,
    );
  });

  it('refuses a second code for an account that already redeemed one', () => {
    expect(MIGRATION).toMatch(
      /exists\s*\(\s*select\s+1\s+from\s+public\.promo_codes\s+where\s+redeemed_by\s*=\s*p_user\s*\)[\s\S]*?already_redeemed_account/i,
    );
  });

  it('grants the comp only AFTER a claim succeeded — never on the miss path', () => {
    const claimAt = MIGRATION.search(/update\s+public\.promo_codes/i);
    expect(claimAt).toBeGreaterThan(-1);
    // The `if not found` that matters is the one guarding the CLAIM, not the earlier
    // user-not-found check — anchor the search past the claim.
    const missRel = MIGRATION.slice(claimAt).search(/if\s+not\s+found\s+then/i);
    expect(missRel).toBeGreaterThan(-1);
    const missAt = claimAt + missRel;
    const grantAt = MIGRATION.search(/update\s+public\.users[\s\S]*?set\s+is_comped\s*=\s*true/i);
    expect(grantAt).toBeGreaterThan(missAt); // the grant is past the early-return block
    // Every miss branch returns before reaching the grant.
    const missBlock = MIGRATION.slice(missAt, grantAt);
    for (const status of ['invalid', 'revoked', 'already_redeemed']) {
      expect(missBlock).toContain(status);
    }
    expect(missBlock).not.toMatch(/set\s+is_comped\s*=\s*true/i);
  });

  it('serializes per account before reading its state', () => {
    expect(MIGRATION).toMatch(/from\s+public\.users\s+where\s+id\s*=\s*p_user\s+for\s+update/i);
  });

  it('is executable only by the service role — never by a signed-in client', () => {
    // SECURITY DEFINER + a caller-supplied p_user would be privilege escalation if
    // `authenticated` could call it directly.
    for (const role of ['public', 'anon', 'authenticated']) {
      expect(MIGRATION).toMatch(
        new RegExp(`revoke all on function public\\.redeem_promo_code\\(text, uuid\\) from ${role}`, 'i'),
      );
    }
    expect(MIGRATION).toMatch(/grant execute on function public\.redeem_promo_code\(text, uuid\) to service_role/i);
  });
});

// ─── 2) The guarantee, as the route actually behaves ──────────────────────────
//
// A stand-in for redeem_promo_code() that implements the SQL's contract: one claim per
// code, one redemption per account. Atomicity is Node's single-threaded execution here,
// which mirrors what Postgres's conditional UPDATE gives us for real.
interface PromoRow { code: string; redeemedBy: string | null; revoked: boolean }
let codes: Map<string, PromoRow>;
let redeemedAccounts: Set<string>;

function redeemStandIn(p_code: string, p_user: string): { status: string; days?: number } {
  if (redeemedAccounts.has(p_user)) return { status: 'already_redeemed_account' };
  const row = codes.get(p_code);
  if (!row) return { status: 'invalid' };
  if (row.revoked) return { status: 'revoked' };
  if (row.redeemedBy !== null) return { status: 'already_redeemed' };
  row.redeemedBy = p_user;
  redeemedAccounts.add(p_user);
  return { status: 'ok', days: 30 };
}

const fakeSupabase = {
  auth: {
    getUser: (token: string) =>
      Promise.resolve(
        token?.startsWith('user:')
          ? { data: { user: { id: token.slice(5) } }, error: null }
          : { data: { user: null }, error: { message: 'bad' } },
      ),
  },
  rpc: (fn: string, args: { p_code: string; p_user: string }) => {
    if (fn !== 'redeem_promo_code') return Promise.resolve({ data: null, error: { message: 'unknown fn' } });
    return Promise.resolve({ data: redeemStandIn(args.p_code, args.p_user), error: null });
  },
};

vi.mock('../lib/supabase', () => ({ getSupabaseAdmin: () => fakeSupabase }));
vi.mock('../lib/logger', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { promo } = await import('./promo');

const CODE = 'GOBLIN-7K4M-QP9X';
const redeem = (user: string, code: string, lang: 'de' | 'en' = 'de') =>
  promo.request('/redeem', {
    method: 'POST',
    headers: { Authorization: `Bearer user:${user}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, lang }),
  });

beforeEach(() => {
  codes = new Map([[CODE, { code: CODE, redeemedBy: null, revoked: false }]]);
  redeemedAccounts = new Set();
});

describe('U2 — a code redeemed by account A is refused for account B', () => {
  it('grants A, then refuses B with honest DE copy and no second grant', async () => {
    const first = await redeem('alice', CODE);
    expect(first.status).toBe(200);
    expect(((await first.json()) as { ok: boolean }).ok).toBe(true);

    const second = await redeem('bob', CODE);
    expect(second.status).toBe(400);
    const body = (await second.json()) as { ok: boolean; status: string; message: string };
    expect(body.ok).toBe(false);
    expect(body.status).toBe('already_redeemed');
    expect(body.message).toMatch(/bereits eingelöst/i);

    // The code still belongs to A. B got nothing.
    expect(codes.get(CODE)!.redeemedBy).toBe('alice');
    expect(redeemedAccounts.has('bob')).toBe(false);
  });

  it('refuses B in English too', async () => {
    await redeem('alice', CODE);
    const res = await redeem('bob', CODE, 'en');
    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/already been redeemed/i);
    expect(body.message).not.toMatch(/[äöüß]/i);
  });

  it('exactly ONE of 20 concurrent accounts wins the same code', async () => {
    const users = Array.from({ length: 20 }, (_, i) => `user${i}`);
    const results = await Promise.all(users.map((u) => redeem(u, CODE)));
    const bodies = await Promise.all(results.map((r) => r.json() as Promise<{ ok: boolean }>));

    const winners = bodies.filter((b) => b.ok);
    expect(winners).toHaveLength(1);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 400)).toHaveLength(19);
    expect(redeemedAccounts.size).toBe(1);
  });
});

describe('U2 — the same account re-entering its own code', () => {
  it('is refused, not silently re-granted, and says a second code is not needed', async () => {
    const first = await redeem('alice', CODE);
    expect(((await first.json()) as { ok: boolean }).ok).toBe(true);

    // The founder's exact move: paste the same code again on the paywall.
    const again = await redeem('alice', CODE);
    expect(again.status).toBe(400);
    const body = (await again.json()) as { ok: boolean; status: string; message: string };
    expect(body.ok).toBe(false);
    expect(body.status).toBe('already_redeemed_account');
    expect(body.message).toMatch(/bereits einen Code eingelöst/i);
    expect(body.message).toMatch(/nicht nötig/i);
    // Honest: it must NOT assert that access is currently active — a redeemed comp
    // can have expired since, and only the billing screen knows.
    expect(body.message).not.toMatch(/ist aktiv|aktiver Zugang/i);
  });

  it('refuses a SECOND, different code for an account that already redeemed one', async () => {
    const other = 'GOBLIN-3N5P-RS7T';
    codes.set(other, { code: other, redeemedBy: null, revoked: false });

    await redeem('alice', CODE);
    const res = await redeem('alice', other);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { status: string }).status).toBe('already_redeemed_account');
    // The second code is untouched and still handable to someone else.
    expect(codes.get(other)!.redeemedBy).toBeNull();
  });

  it('an unspent code still works for a fresh account afterwards', async () => {
    const other = 'GOBLIN-3N5P-RS7T';
    codes.set(other, { code: other, redeemedBy: null, revoked: false });
    await redeem('alice', CODE);

    const res = await redeem('carla', other);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
  });
});
