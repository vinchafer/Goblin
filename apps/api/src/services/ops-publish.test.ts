/**
 * AKT 2 · PHASE 2 · U2.4 — the publish path.
 *
 * Every dependency is faked, so what is under test is the ORDER and the HONESTY of
 * the flow rather than Cloudflare's behaviour. The two properties that matter most
 * and are asserted hardest:
 *
 *   • a scan block means NOTHING was uploaded, routed or written — not "uploaded
 *     and then hidden"
 *   • "live" is never reported without a green verification of the public URL
 *
 * The real substrate is U2.8's job, from the deployed API.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkNameAvailable,
  loadArtifact,
  publishHostedApp,
  renameHostedApp,
  type PublishDeps,
} from './ops-publish';
import type { OpsApp } from './ops-apps-store';
import { wireForms } from './ops-form-wiring';
import type { ReviewItem } from './ops-review-queue';
import type { AupCategory } from './safety/abuse-classifier';
import { reviewMessage } from './safety/review-messages';

const ok = <T>(value: T) => ({ ok: true as const, value });
const cfErr = (code: string, message = 'nope') =>
  ({ ok: false as const, error: { code: code as 'upstream', message } });

const INDEX = '<!doctype html><html><head><title>Mein Laden</title></head><body><h1>Hallo</h1></body></html>';

function app(overrides: Partial<OpsApp> = {}): OpsApp {
  return {
    appId: 'app-1', userId: 'user-1', projectId: 'proj-1', appName: 'meinladen',
    status: 'active', capsProfile: 'free-static', r2Prefix: 'apps/app-1/', routeKey: 'route:meinladen',
    workerScriptName: null, d1DatabaseId: null, lastPublishedAt: null, createdAt: '2026-07-28T00:00:00Z',
    ...overrides,
  };
}

/**
 * PHASE 3 — the scan dep is now the two-stage runner and is async. These builders
 * produce the three outcomes it can return, so a test names the verdict it wants
 * rather than assembling the shape.
 */
const stage1Pass = { verdict: 'pass' as const, ruleIds: [], hits: [], scannedFiles: 1, scannedBytes: 10 };

function passOutcome() {
  return {
    verdict: 'pass' as const, decidedBy: 'none' as const, stage1: stage1Pass,
    stage2: { verdict: 'pass' as const, reason: 'clean' as const, categories: [], confidence: 'high' as const,
      tokens: { estimatedInput: 100, input: 700, output: 20 }, sentChars: 400, model: 'deepseek-ai/DeepSeek-V3.2', tookMs: 5 },
    categories: [], ruleIds: [], scannedFiles: 1, scannedBytes: 10,
  };
}

function blockOutcome() {
  return {
    verdict: 'block' as const, decidedBy: 'stage1' as const,
    stage1: { ...stage1Pass, verdict: 'block' as const, ruleIds: ['PH-BRAND-CRED'] },
    stage2: null, area: 'phishing' as const, categories: [],
    message: 'Diese Veröffentlichung wurde gestoppt: …Nutzungsrichtlinie… Feedback-Knopf…',
    ruleIds: ['PH-BRAND-CRED'], scannedFiles: 1, scannedBytes: 10,
  };
}

function reviewOutcome(reason: 'flagged' | 'unavailable' = 'flagged', categories: AupCategory[] = ['deception']) {
  return {
    verdict: 'review' as const, decidedBy: 'stage2' as const, stage1: stage1Pass,
    stage2: { verdict: 'review' as const, reason, categories, confidence: 'medium' as const,
      tokens: { estimatedInput: 100, input: 700, output: 20 }, sentChars: 400, model: 'deepseek-ai/DeepSeek-V3.2', tookMs: 5 },
    categories, message: reviewMessage(categories, reason === 'flagged'),
    ruleIds: [], scannedFiles: 1, scannedBytes: 10,
  };
}

/** Fake deps: a one-file project, everything succeeds, nothing published yet. */
function deps(overrides: Partial<PublishDeps> = {}, files: Record<string, string> = { 'index.html': INDEX }): PublishDeps {
  return {
    listFiles: vi.fn(async () => Object.keys(files)),
    getFileBytes: vi.fn(async (_p: string, path: string) =>
      files[path] === undefined ? null : { bytes: Buffer.from(files[path]!, 'utf8') },
    ),
    scan: vi.fn(async () => passOutcome()),
    enqueueReview: vi.fn(async () => ({ id: 'review-1' }) as unknown as ReviewItem),
    putAppFiles: vi.fn(async () => ok({ files: 1, bytes: 10 })),
    setRoute: vi.fn(async () => ok({ name: 'meinladen', appId: 'app-1', status: 'active' as const })),
    getRoute: vi.fn(async () => ok(null)),
    deleteRoute: vi.fn(async () => ok({ deleted: true })),
    verify: vi.fn(async () => ({ ok: true, entryOk: true, assetsChecked: 2, assetsMatched: 2, mismatched: [] })),
    claimOpsApp: vi.fn(async () => app({ status: 'provisioning' })),
    findOpsAppByName: vi.fn(async () => null),
    findOpsAppByProject: vi.fn(async () => null),
    markOpsAppPublished: vi.fn(async () => true),
    markOpsAppFailed: vi.fn(async () => true),
    renameOpsApp: vi.fn(async () => true),
    appsDomain: () => 'justgoblin.app',
    // PHASE 4. The REAL wiring, not a stub: these fixtures carry no form, so it is a
    // no-op — and that is exactly the property worth holding. A stub here would let
    // the Phase-4 branch drift out from under every Phase-2/3 test in this file.
    wireForms,
    provisionAppDatabase: vi.fn(async () => { throw new Error('no form here — must never be reached'); }),
    setOpsAppD1Database: vi.fn(async () => true),
    teardownAppDatabase: vi.fn(async () => ({ attempted: false, gone: null })),
    ...overrides,
  } as unknown as PublishDeps;
}

const input = { userId: 'user-1', projectId: 'proj-1', name: 'meinladen' };

beforeEach(() => vi.clearAllMocks());

// ── Availability ────────────────────────────────────────────────────────────

describe('name availability', () => {
  it('accepts a free name and reports the URL it would produce', async () => {
    const r = await checkNameAvailable('MeinLaden', deps());
    expect(r).toMatchObject({ ok: true, normalized: 'meinladen', url: 'https://meinladen.justgoblin.app' });
  });

  it('refuses a name already in the registry, in German', async () => {
    const r = await checkNameAvailable('meinladen', deps({ findOpsAppByName: vi.fn(async () => app()) }));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('taken');
    expect(r.message).toContain('Dieser Name ist vergeben');
  });

  it('refuses a RELEASED name, and says why it stays reserved', async () => {
    const r = await checkNameAvailable('altername', deps({
      getRoute: vi.fn(async () => ok({ name: 'altername', appId: 'app-9', status: 'released' as const })),
    }));
    expect(r.reason).toBe('released');
    expect(r.message).toContain('alte Links zeigen noch darauf');
  });

  it('refuses a name whose KV route exists without a registry row', async () => {
    // Belt and braces: a route written by hand still blocks a claim.
    const r = await checkNameAvailable('meinladen', deps({
      getRoute: vi.fn(async () => ok({ name: 'meinladen', appId: 'app-9', status: 'active' as const })),
    }));
    expect(r.reason).toBe('taken');
  });

  it('does not treat a KV blip as proof the name is free OR taken', async () => {
    // The registry already said no; the unique index is the real arbiter at insert.
    const r = await checkNameAvailable('meinladen', deps({ getRoute: vi.fn(async () => cfErr('timeout')) }));
    expect(r.ok).toBe(true);
  });

  it('checks shape before touching any I/O', async () => {
    const d = deps();
    const r = await checkNameAvailable('admin', d);
    expect(r.reason).toBe('reserved');
    expect(d.findOpsAppByName).not.toHaveBeenCalled();
    expect(d.getRoute).not.toHaveBeenCalled();
  });
});

// ── The artifact ────────────────────────────────────────────────────────────

describe('artifact loading', () => {
  it('loads bytes, not strings, so binaries survive', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0xfe]);
    const d = deps({
      listFiles: vi.fn(async () => ['index.html', 'logo.png']),
      getFileBytes: vi.fn(async (_p: string, path: string) =>
        path === 'logo.png' ? { bytes: png } : { bytes: Buffer.from(INDEX, 'utf8') },
      ),
    });
    const a = await loadArtifact('proj-1', d);
    const logo = a.files.find((f) => f.path === 'logo.png')!;
    expect(logo.bytes.equals(png)).toBe(true);
  });

  it('gives the scanner text only for scannable types', async () => {
    const d = deps({
      listFiles: vi.fn(async () => ['index.html', 'logo.png']),
      getFileBytes: vi.fn(async () => ({ bytes: Buffer.from('x') })),
    });
    const a = await loadArtifact('proj-1', d);
    expect(a.scanFiles.find((f) => f.path === 'index.html')?.content).toBeTypeOf('string');
    expect(a.scanFiles.find((f) => f.path === 'logo.png')?.content).toBeUndefined();
    // …but the size of every file counts toward the artifact limits.
    expect(a.scanFiles).toHaveLength(2);
  });

  it('skips a file that cannot be read instead of failing the publish', async () => {
    const d = deps({
      listFiles: vi.fn(async () => ['index.html', 'kaputt.js']),
      getFileBytes: vi.fn(async (_p: string, path: string) =>
        path === 'kaputt.js' ? Promise.reject(new Error('gone')) : { bytes: Buffer.from(INDEX) },
      ),
    });
    const a = await loadArtifact('proj-1', d);
    expect(a.files.map((f) => f.path)).toEqual(['index.html']);
  });
});

// ── The happy path ──────────────────────────────────────────────────────────

describe('publish — the happy path', () => {
  it('reports live, with the URL and the verification', async () => {
    const r = await publishHostedApp(input, deps());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r).toMatchObject({ stage: 'live', name: 'meinladen', url: 'https://meinladen.justgoblin.app', republished: false });
    expect(r.verification.ok).toBe(true);
  });

  it('does everything in the required order', async () => {
    const order: string[] = [];
    const track = <T extends (...a: never[]) => unknown>(label: string, fn: T) =>
      vi.fn((...a: Parameters<T>) => { order.push(label); return fn(...a); });

    const d = deps({
      scan: track('scan', async () => passOutcome()),
      claimOpsApp: track('claim', async () => app({ status: 'provisioning' })),
      putAppFiles: track('upload', async () => ok({ files: 1, bytes: 10 })),
      setRoute: track('route', async () => ok({ name: 'meinladen', appId: 'app-1', status: 'active' as const })),
      verify: track('verify', async () => ({ ok: true, entryOk: true, assetsChecked: 1, assetsMatched: 1, mismatched: [] })),
      markOpsAppPublished: track('published', async () => true),
    } as unknown as Partial<PublishDeps>);

    await publishHostedApp(input, d);
    expect(order).toEqual(['scan', 'claim', 'upload', 'route', 'verify', 'published']);
  });

  it('marks published ONLY with a verified flag the caller cannot fake', async () => {
    const d = deps();
    await publishHostedApp(input, d);
    expect(d.markOpsAppPublished).toHaveBeenCalledWith('app-1', expect.objectContaining({ verified: true }));
  });

  it('is idempotent — a republish keeps the app id, the name and the URL', async () => {
    const d = deps({ findOpsAppByProject: vi.fn(async () => app({ appName: 'meinladen' })) });
    const r = await publishHostedApp({ ...input, name: 'ganz-anderer-name' }, d);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // The name in the request is IGNORED on a republish: the URL people already
    // have must not move because someone typed something else into a form.
    expect(r.name).toBe('meinladen');
    expect(r.republished).toBe(true);
    expect(d.claimOpsApp).not.toHaveBeenCalled();
  });
});

// ── The scan gate ───────────────────────────────────────────────────────────

describe('publish — a scan block stops everything', () => {
  const blocked = () =>
    deps({
      scan: vi.fn(async () => blockOutcome()),
    });

  it('uploads nothing, routes nothing, registers nothing', async () => {
    const d = blocked();
    const r = await publishHostedApp(input, d);
    expect(r.ok).toBe(false);
    expect(d.putAppFiles).not.toHaveBeenCalled();
    expect(d.setRoute).not.toHaveBeenCalled();
    expect(d.claimOpsApp).not.toHaveBeenCalled();
  });

  it('returns the German message and the stage it died at', async () => {
    const r = await publishHostedApp(input, blocked());
    if (r.ok) throw new Error('expected a block');
    expect(r.stage).toBe('scan');
    expect(r.code).toBe('scan_blocked');
    expect(r.message).toContain('Nutzungsrichtlinie');
  });

  it('carries the rule ids for the appeal, but never inside the message', async () => {
    const r = await publishHostedApp(input, blocked());
    if (r.ok) throw new Error('expected a block');
    expect(r.ruleIds).toEqual(['PH-BRAND-CRED']);
    expect(r.message).not.toContain('PH-BRAND-CRED');
  });

  it('scans BEFORE claiming a name — a blocked publish burns no name', async () => {
    const d = blocked();
    await publishHostedApp(input, d);
    expect(d.claimOpsApp).not.toHaveBeenCalled();
  });
});

// ── The third verdict (PHASE 3 · U3.2) ──────────────────────────────────────

describe('publish — a stage-2 review holds everything', () => {
  const held = (over: Partial<PublishDeps> = {}, reason: 'flagged' | 'unavailable' = 'flagged') =>
    deps({ scan: vi.fn(async () => reviewOutcome(reason)), ...over } as unknown as Partial<PublishDeps>);

  it('uploads nothing, routes nothing, registers nothing — the same as a block', async () => {
    const d = held();
    await publishHostedApp(input, d);
    expect(d.putAppFiles).not.toHaveBeenCalled();
    expect(d.setRoute).not.toHaveBeenCalled();
    expect(d.claimOpsApp).not.toHaveBeenCalled();
    expect(d.markOpsAppPublished).not.toHaveBeenCalled();
  });

  it('records the hold in the queue and hands back its id', async () => {
    const d = held();
    const r = await publishHostedApp(input, d);
    if (r.ok) throw new Error('expected a review');
    expect(r.code).toBe('scan_review');
    expect(r.reviewId).toBe('review-1');
    expect(d.enqueueReview).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1', projectId: 'proj-1', requestedName: 'meinladen',
      stage1Verdict: 'pass', stage2Reason: 'flagged', categories: ['deception'],
    }));
  });

  it('says what happened, in German, and commits to no timeline', async () => {
    const r = await publishHostedApp(input, held());
    if (r.ok) throw new Error('expected a review');
    expect(r.message).toContain('Hochgeladen wurde nichts');
    expect(r.message).toContain('Eine feste Frist gibt es dafür nicht');
    // No invented duration anywhere in the sentence.
    expect(r.message).not.toMatch(/\d+\s*(Stunden|Stunde|Tagen|Tage|Minuten|Werktag)/i);
  });

  it('names the CATEGORY and never the mechanism behind it', async () => {
    const r = await publishHostedApp(input, held());
    if (r.ok) throw new Error('expected a review');
    for (const leak of ['deception', 'classifier', 'Stage', 'stage2', 'confidence', 'DeepSeek', 'Swift']) {
      expect(r.message).not.toContain(leak);
    }
  });

  it('blames the check, not the app, when the check could not finish', async () => {
    const r = await publishHostedApp(input, held({}, 'unavailable'));
    if (r.ok) throw new Error('expected a review');
    expect(r.message).toContain('Das sagt nichts über deine App aus');
  });

  it('does NOT promise a human when the hold could not be recorded', async () => {
    const d = held({ enqueueReview: vi.fn(async () => null) });
    const r = await publishHostedApp(input, d);
    if (r.ok) throw new Error('expected a review');
    expect(r.code).toBe('review_unqueued');
    expect(r.message).toContain('Bitte versuch es später noch einmal');
    expect(r.message).not.toContain('Sobald jemand daraufgesehen hat');
    expect(d.putAppFiles).not.toHaveBeenCalled();
  });

  it('holds a REPUBLISH too — the live app stays untouched, the update does not land', async () => {
    const d = held({ findOpsAppByProject: vi.fn(async () => app({ appName: 'meinladen' })) });
    const r = await publishHostedApp(input, d);
    expect(r.ok).toBe(false);
    expect(d.putAppFiles).not.toHaveBeenCalled();
    expect(d.deleteRoute).not.toHaveBeenCalled(); // the live route is left alone
    expect(d.markOpsAppFailed).not.toHaveBeenCalled();
  });
});

// ── Artifact preconditions ──────────────────────────────────────────────────

describe('publish — artifact preconditions', () => {
  it('refuses an empty project honestly', async () => {
    const r = await publishHostedApp(input, deps({ listFiles: vi.fn(async () => []) }, {}));
    if (r.ok) throw new Error('expected a failure');
    expect(r.code).toBe('empty_artifact');
    expect(r.message).toContain('noch keine Dateien');
  });

  it('refuses a project with no index.html, and says which file is missing', async () => {
    const r = await publishHostedApp(input, deps({}, { 'seite.html': INDEX }));
    if (r.ok) throw new Error('expected a failure');
    expect(r.code).toBe('no_entry');
    expect(r.message).toContain('index.html');
  });
});

// ── Registry refusals ───────────────────────────────────────────────────────

describe('publish — the registry is not optional', () => {
  it('refuses to upload when the registry cannot record the app', async () => {
    // A publish that uploaded files and wrote a route with no row pointing at them
    // is exactly the orphan ABUSE_RESPONSE §8.3 gap 3 is about.
    const d = deps({ claimOpsApp: vi.fn(async () => null) });
    const r = await publishHostedApp(input, d);
    if (r.ok) throw new Error('expected a failure');
    expect(r.code).toBe('registry_unavailable');
    expect(d.putAppFiles).not.toHaveBeenCalled();
    expect(d.setRoute).not.toHaveBeenCalled();
  });

  it('refuses a name that is already taken', async () => {
    const r = await publishHostedApp(input, deps({ findOpsAppByName: vi.fn(async () => app()) }));
    if (r.ok) throw new Error('expected a failure');
    expect(r.code).toBe('name_taken');
    expect(r.stage).toBe('name');
  });
});

// ── Failure handling ────────────────────────────────────────────────────────

describe('publish — failures are recorded, never glossed over', () => {
  it('marks the app failed when the upload dies', async () => {
    const d = deps({ putAppFiles: vi.fn(async () => cfErr('upstream')) });
    const r = await publishHostedApp(input, d);
    if (r.ok) throw new Error('expected a failure');
    expect(r.code).toBe('upload_failed');
    expect(d.markOpsAppFailed).toHaveBeenCalledWith('app-1');
    expect(d.setRoute).not.toHaveBeenCalled();
  });

  it('marks the app failed when the route cannot be written', async () => {
    const d = deps({ setRoute: vi.fn(async () => cfErr('auth')) });
    const r = await publishHostedApp(input, d);
    if (r.ok) throw new Error('expected a failure');
    expect(r.code).toBe('route_failed');
    expect(d.markOpsAppFailed).toHaveBeenCalled();
    expect(d.verify).not.toHaveBeenCalled();
  });

  it('NEVER reports live when verification fails', async () => {
    const d = deps({
      verify: vi.fn(async () => ({ ok: false, reason: 'Die App ist noch nicht erreichbar.', entryOk: false, assetsChecked: 0, assetsMatched: 0, mismatched: [] })),
    });
    const r = await publishHostedApp(input, d);
    if (r.ok) throw new Error('expected a failure');
    expect(r.code).toBe('not_verified');
    expect(d.markOpsAppPublished).not.toHaveBeenCalled();
  });

  it('withdraws a NEW app`s route when it never verified — nothing claims to be live', async () => {
    const d = deps({
      verify: vi.fn(async () => ({ ok: false, reason: 'nope', entryOk: false, assetsChecked: 0, assetsMatched: 0, mismatched: [] })),
    });
    await publishHostedApp(input, d);
    expect(d.deleteRoute).toHaveBeenCalledWith('meinladen');
  });

  it('KEEPS a republish`s route when verification fails — the app was already live', async () => {
    // Pulling the route over a verification hiccup would take down something that
    // works. The failure is reported; the address stays.
    const d = deps({
      findOpsAppByProject: vi.fn(async () => app()),
      verify: vi.fn(async () => ({ ok: false, reason: 'nope', entryOk: false, assetsChecked: 0, assetsMatched: 0, mismatched: [] })),
    });
    await publishHostedApp(input, d);
    expect(d.deleteRoute).not.toHaveBeenCalled();
  });

  it('reports the stage every failure died at', async () => {
    const cases: Array<[Partial<PublishDeps>, string]> = [
      [{ findOpsAppByName: vi.fn(async () => app()) }, 'name'],
      [{ listFiles: vi.fn(async () => []) }, 'artifact'],
      [{ claimOpsApp: vi.fn(async () => null) }, 'registry'],
      [{ putAppFiles: vi.fn(async () => cfErr('upstream')) }, 'upload'],
      [{ setRoute: vi.fn(async () => cfErr('upstream')) }, 'route'],
      [{ verify: vi.fn(async () => ({ ok: false, entryOk: false, assetsChecked: 0, assetsMatched: 0, mismatched: [] })) }, 'verify'],
    ];
    for (const [override, stage] of cases) {
      const r = await publishHostedApp(input, deps(override as Partial<PublishDeps>));
      if (r.ok) throw new Error(`expected a failure at ${stage}`);
      expect(r.stage).toBe(stage);
    }
  });

  it('never leaks a raw error into a user-facing message', async () => {
    const d = deps({ putAppFiles: vi.fn(async () => cfErr('upstream', 'S3 SignatureDoesNotMatch at /apps/x')) });
    const r = await publishHostedApp(input, d);
    if (r.ok) throw new Error('expected a failure');
    expect(r.message).not.toContain('SignatureDoesNotMatch');
    expect(r.message).not.toMatch(/S3|R2|KV|HTTP \d/);
  });
});

// ── Rename ──────────────────────────────────────────────────────────────────

describe('rename — the old address tells the truth', () => {
  it('claims the new route, moves the registry, THEN tombstones the old name', async () => {
    const order: string[] = [];
    const d = deps({
      setRoute: vi.fn(async (name: string, _id: string, opts?: { status?: string }) => {
        order.push(`${name}:${opts?.status}`);
        return ok({ name, appId: 'app-1', status: (opts?.status ?? 'active') as 'active' });
      }),
      renameOpsApp: vi.fn(async () => { order.push('registry'); return true; }),
    } as unknown as Partial<PublishDeps>);

    const r = await renameHostedApp(app(), 'neuername', d);
    expect(r.ok).toBe(true);
    expect(order).toEqual(['neuername:active', 'registry', 'meinladen:released']);
  });

  it('leaves a 410 tombstone, not a redirect and not a deletion', async () => {
    const d = deps();
    const r = await renameHostedApp(app(), 'neuername', d);
    expect(r.tombstoned).toBe(true);
    expect(d.setRoute).toHaveBeenCalledWith('meinladen', 'app-1', { status: 'released' });
    expect(d.deleteRoute).not.toHaveBeenCalled();
  });

  it('keeps the app at its OLD address when the new route cannot be written', async () => {
    const d = deps({ setRoute: vi.fn(async () => cfErr('auth')) });
    const r = await renameHostedApp(app(), 'neuername', d);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('unter der alten Adresse weiter erreichbar');
  });

  it('undoes the new route when the registry did not move', async () => {
    // Two addresses for one app with the registry disagreeing about which is real
    // is worse than no rename at all.
    const d = deps({ renameOpsApp: vi.fn(async () => false) });
    const r = await renameHostedApp(app(), 'neuername', d);
    expect(r.ok).toBe(false);
    expect(d.deleteRoute).toHaveBeenCalledWith('neuername');
  });

  it('refuses a renamed-to name that is taken, reserved or released', async () => {
    expect((await renameHostedApp(app(), 'admin', deps())).code).toBe('invalid_name');
    expect((await renameHostedApp(app(), 'belegt', deps({ findOpsAppByName: vi.fn(async () => app()) }))).code).toBe('name_taken');
    expect(
      (await renameHostedApp(app(), 'frueher', deps({
        getRoute: vi.fn(async () => ok({ name: 'frueher', appId: 'x', status: 'released' as const })),
      }))).code,
    ).toBe('name_released');
  });

  it('says so plainly when the name has not changed', async () => {
    const r = await renameHostedApp(app(), 'MeinLaden', deps());
    expect(r.code).toBe('same_name');
    expect(r.message).toContain('heißt schon so');
  });

  it('still reports success when only the tombstone write failed, and logs it', async () => {
    // The rename DID happen. Pretending otherwise would be its own lie; the old
    // address failing to answer 410 is a smaller, separately-logged problem.
    let call = 0;
    const d = deps({
      setRoute: vi.fn(async (name: string) => (++call === 2 ? cfErr('upstream') : ok({ name, appId: 'app-1', status: 'active' as const }))),
    } as unknown as Partial<PublishDeps>);
    const r = await renameHostedApp(app(), 'neuername', d);
    expect(r.ok).toBe(true);
    expect(r.tombstoned).toBe(false);
  });
});

// ── PHASE 4 · U4.7 — the form branch of the publish path ───────────────────

describe('publish — an app that declares a form', () => {
  const FORM_PAGE = '<!doctype html><html lang="de"><body><form id="kontakt"><input name="email"></form></body></html>';
  const withForm = { 'index.html': FORM_PAGE };

  /** Everything the form branch needs to succeed. */
  const formDeps = (over: Partial<PublishDeps> = {}) =>
    deps(
      {
        wireForms: ((files: Array<{ path: string; bytes: Buffer }>) =>
          wireForms(files, { endpoint: 'https://api.justgoblin.com', siteKey: '0xkey' })) as PublishDeps['wireForms'],
        provisionAppDatabase: vi.fn(async () => ({ ok: true as const, databaseId: 'db-1', jurisdiction: 'eu' })),
        ...over,
      } as unknown as Partial<PublishDeps>,
      withForm,
    );

  it('wires the form, provisions the database, and reports both', async () => {
    const d = formDeps();
    const r = await publishHostedApp(input, d);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.forms.wired).toEqual([{ path: 'index.html', formId: 'kontakt' }]);
    expect(d.provisionAppDatabase).toHaveBeenCalledWith('app-1');
    expect(d.setOpsAppD1Database).toHaveBeenCalledWith('app-1', 'db-1');
  });

  it('SCANS WHAT IT UPLOADS — the injected bytes go through the scan like every other byte', async () => {
    const scan = vi.fn(async () => passOutcome());
    const d = formDeps({ scan: scan as unknown as PublishDeps['scan'] });
    await publishHostedApp(input, d);

    // What the scan saw…
    const scanned = ((scan.mock.calls as unknown as unknown[][])[0]?.[0] ?? []) as Array<{ path: string; content?: string }>;
    const scannedHtml = scanned.find((f) => f.path === 'index.html')?.content ?? '';
    expect(scannedHtml).toContain('data-goblin-form="kontakt"');
    expect(scannedHtml).toContain('cf-turnstile');

    // …is byte-identical to what was uploaded.
    const uploaded = ((d.putAppFiles as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[1] ?? []) as Array<{
      path: string;
      content: Buffer;
    }>;
    const uploadedHtml = uploaded.find((f) => f.path === 'index.html')?.content?.toString('utf8') ?? '';
    expect(uploadedHtml).toBe(scannedHtml);
  });

  it('provisions the database BEFORE the upload — never a live app with an unhosted form', async () => {
    const order: string[] = [];
    const d = formDeps({
      provisionAppDatabase: vi.fn(async () => {
        order.push('d1');
        return { ok: true as const, databaseId: 'db-1', jurisdiction: 'eu' };
      }) as unknown as PublishDeps['provisionAppDatabase'],
      putAppFiles: vi.fn(async () => {
        order.push('upload');
        return ok({ files: 1, bytes: 10 });
      }) as unknown as PublishDeps['putAppFiles'],
    });
    await publishHostedApp(input, d);
    expect(order).toEqual(['d1', 'upload']);
  });

  it('a database that cannot be created REFUSES the publish — nothing uploaded, nothing routed', async () => {
    const d = formDeps({
      provisionAppDatabase: vi.fn(async () => ({
        ok: false as const,
        code: 'limit_reached' as const,
        message: 'Goblin kann gerade keine weitere App mit Formular veröffentlichen.',
      })) as unknown as PublishDeps['provisionAppDatabase'],
    });
    const r = await publishHostedApp(input, d);
    expect(r).toMatchObject({ ok: false, code: 'd1_unavailable', stage: 'registry' });
    expect(d.putAppFiles).not.toHaveBeenCalled();
    expect(d.setRoute).not.toHaveBeenCalled();
    expect(d.markOpsAppFailed).toHaveBeenCalledWith('app-1');
  });

  it('a database that cannot be RECORDED is torn back down — an unrecorded database is an orphan', async () => {
    const d = formDeps({ setOpsAppD1Database: vi.fn(async () => false) as unknown as PublishDeps['setOpsAppD1Database'] });
    const r = await publishHostedApp(input, d);
    expect(r).toMatchObject({ ok: false, code: 'd1_unavailable' });
    expect(d.teardownAppDatabase).toHaveBeenCalledWith('db-1');
    expect(d.putAppFiles).not.toHaveBeenCalled();
  });

  it('an unhostable form refuses the publish before the scan — the live app stays exactly as it is', async () => {
    const d = deps(
      {
        wireForms: (() => ({ ok: false as const, code: 'no_site_key' as const, message: 'Wir veröffentlichen sie deshalb NICHT.' })) as unknown as PublishDeps['wireForms'],
      } as unknown as Partial<PublishDeps>,
      withForm,
    );
    const r = await publishHostedApp(input, d);
    expect(r).toMatchObject({ ok: false, code: 'form_unwirable', stage: 'artifact' });
    expect(d.scan).not.toHaveBeenCalled();
    expect(d.claimOpsApp).not.toHaveBeenCalled();
    expect(d.putAppFiles).not.toHaveBeenCalled();
  });

  it('a REPUBLISH reuses the database it already has — a second one would abandon the owner’s submissions', async () => {
    const existing = app({ status: 'active', d1DatabaseId: 'db-existing' });
    const d = formDeps({ findOpsAppByProject: vi.fn(async () => existing) as unknown as PublishDeps['findOpsAppByProject'] });
    const r = await publishHostedApp(input, d);
    expect(r.ok).toBe(true);
    expect(d.provisionAppDatabase).not.toHaveBeenCalled();
  });

  it('an app with NO form never gets a database — the ten-database ceiling is not spent on nothing', async () => {
    const d = deps();
    const r = await publishHostedApp(input, d);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.forms.wired).toEqual([]);
    expect(d.provisionAppDatabase).not.toHaveBeenCalled();
  });

  it('FOUNDER-WALK-6 U2/F2: stage 2 never sees the injected CAPTCHA/fetch bytes, only the wired count', async () => {
    // What made a harmless signup form and a harmless contact page read as
    // phishing/circumvention on the 2026-08-15 walk: stage 2 was shown Goblin's
    // OWN injected wiring with nothing telling it Goblin put it there. The scan
    // dep's SECOND argument (ctx) is what `deps.scan` (runHostedPublishScan)
    // reads to build stage 2's view — assert it carries the pre-wiring text and
    // the count, never the wired bytes.
    const scan = vi.fn(async () => passOutcome());
    const d = formDeps({ scan: scan as unknown as PublishDeps['scan'] });
    await publishHostedApp(input, d);

    const ctx = ((scan.mock.calls as unknown as unknown[][])[0]?.[1] ?? {}) as {
      classifierFiles?: Array<{ path: string; content?: string }>;
      wiredFormCount?: number;
    };
    expect(ctx.wiredFormCount).toBe(1);
    const classifierHtml = ctx.classifierFiles?.find((f) => f.path === 'index.html')?.content ?? '';
    expect(classifierHtml).not.toContain('cf-turnstile');
    expect(classifierHtml).not.toContain('data-goblin-form');
    expect(classifierHtml).toBe(FORM_PAGE);

    // Stage 1's argument (the FIRST one) is unaffected: it still gets the real,
    // uploaded bytes — this fix narrows stage 2's view only.
    const stage1Files = ((scan.mock.calls as unknown as unknown[][])[0]?.[0] ?? []) as Array<{ path: string; content?: string }>;
    expect(stage1Files.find((f) => f.path === 'index.html')?.content).toContain('cf-turnstile');
  });

  it('an app with no form never sets classifierFiles/wiredFormCount — nothing to correct for', async () => {
    const scan = vi.fn(async () => passOutcome());
    const d = deps({ scan: scan as unknown as PublishDeps['scan'] }); // no form in this fixture
    await publishHostedApp(input, d);
    const ctx = ((scan.mock.calls as unknown as unknown[][])[0]?.[1] ?? {}) as Record<string, unknown>;
    expect(ctx.classifierFiles).toBeUndefined();
    expect(ctx.wiredFormCount).toBeUndefined();
  });

  it('reports a form it deliberately left alone, so the builder is not left guessing', async () => {
    const d = formDeps();
    const r = await publishHostedApp(
      input,
      deps(
        {
          wireForms: ((files: Array<{ path: string; bytes: Buffer }>) =>
            wireForms(files, { endpoint: 'https://api.justgoblin.com', siteKey: '0xkey' })) as PublishDeps['wireForms'],
          provisionAppDatabase: d.provisionAppDatabase,
        } as unknown as Partial<PublishDeps>,
        { 'index.html': '<!doctype html><html><body><form action="https://formspree.io/x"><input name="a"></form></body></html>' },
      ),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.forms.wired).toEqual([]);
    expect(r.forms.skipped).toEqual([{ path: 'index.html', why: 'has_action' }]);
  });
});
