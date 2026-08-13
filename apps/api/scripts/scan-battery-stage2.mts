/**
 * AKT 2 · PHASE 3 · U3.5 — THE REAL-MODEL GATE for the stage-2 battery.
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A SCRIPT AND NOT A TEST.
 *
 * The offline suite (`hosted-scan-battery-v2.test.ts`) proves everything about
 * this battery that can be proved without a model: that stage 1 lets the hostile
 * fixtures through, that it blocks none of the legitimate ones, that they all fit
 * the budget, and that a hold produces the right German. What it cannot prove is
 * whether the MODEL is any good at the ten judgements, and no amount of mocking
 * will change that.
 *
 * So the accuracy gate runs here, against the real deployed classifier, with the
 * founder's own credentials — never in CI, never in a unit test, and never from a
 * session that has no business holding an API key.
 *
 * ── The flakiness law ────────────────────────────────────────────────────────
 * A model is not a function. Running the battery once and reporting 10/10 would be
 * reporting one sample as if it were a property. So every fixture is classified
 * FIVE times and the report carries, per fixture, how many of the five agreed with
 * the expected verdict. A headline claim needs ≥4/5. The script prints the rate it
 * observed, whatever it is, and prints it as a number rather than a grade.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   cd apps/api
 *   GOBLIN_HOSTED_ENABLED=true DEEPINFRA_API_KEY=… \
 *     pnpm exec tsx scripts/scan-battery-stage2.mts [runs] [outFile]
 *
 * Cost: 10 fixtures × 5 runs ≈ 50 Swift calls ≈ $0.008 at the ledger's M-A2 figure.
 * The script prints the token totals it actually observed so M-A2 can be
 * reconciled against real usage instead of an estimate.
 * ════════════════════════════════════════════════════════════════════════════════
 */

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyArtifact, classifierMaxInputTokens, extractCandidateText } from '../src/services/safety/abuse-classifier.js';
import { getGoblinHostedConfig } from '../src/services/goblin-hosted.js';
import { BATTERY_V2, BATTERY_V2_DIR } from '../src/services/safety/hosted-scan-battery-v2.js';
import { scanHostedArtifact, type HostedScanFile } from '../src/services/safety/hosted-publish-scan.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../src/services/safety', BATTERY_V2_DIR);

const RUNS = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 5;
const OUT = process.argv[3] ?? resolve(HERE, '../../../evidence/akt2-phase3/stage2-battery.json');

function loadFixture(name: string): HostedScanFile[] {
  const root = join(ROOT, name);
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

interface FixtureReport {
  fixture: string;
  expected: 'pass' | 'review';
  /** One entry per run. */
  observed: string[];
  reasons: string[];
  categories: string[][];
  /** How many of the runs matched the expectation. The flakiness number. */
  agreed: number;
  runs: number;
  /** Stage 1's verdict — must be `pass` or the fixture is not testing stage 2. */
  stage1: string;
  estimatedInputTokens: number;
  observedInputTokens: number[];
  observedOutputTokens: number[];
}

async function main() {
  const config = getGoblinHostedConfig();
  if (!config) {
    // Refusing loudly rather than producing a report full of `unavailable`
    // reviews that would technically be "correct" and prove nothing.
    console.error(
      'REFUSED: Goblin-hosted inference is not configured in this environment.\n' +
        'Every fixture would be held with reason=unavailable, which is the classifier behaving\n' +
        'correctly and says nothing about its accuracy. Set GOBLIN_HOSTED_ENABLED=true and\n' +
        'DEEPINFRA_API_KEY, then run again.',
    );
    process.exit(2);
  }

  console.log(`stage-2 battery · ${BATTERY_V2.length} fixtures × ${RUNS} runs · budget ${classifierMaxInputTokens()} tok\n`);

  const reports: FixtureReport[] = [];
  for (const c of BATTERY_V2) {
    const files = loadFixture(c.fixture);
    const stage1 = scanHostedArtifact(files);
    const est = extractCandidateText(files).estimatedTokens;

    const r: FixtureReport = {
      fixture: c.fixture, expected: c.stage2, observed: [], reasons: [], categories: [],
      agreed: 0, runs: RUNS, stage1: stage1.verdict, estimatedInputTokens: est,
      observedInputTokens: [], observedOutputTokens: [],
    };

    for (let i = 0; i < RUNS; i++) {
      const res = await classifyArtifact(files);
      r.observed.push(res.verdict);
      r.reasons.push(res.reason);
      r.categories.push(res.categories);
      r.observedInputTokens.push(res.tokens.input);
      r.observedOutputTokens.push(res.tokens.output);
      if (res.verdict === c.stage2) r.agreed++;
    }

    reports.push(r);
    const flag = r.agreed >= Math.ceil(RUNS * 0.8) ? ' ' : '!';
    console.log(
      `${flag} ${c.fixture.padEnd(32)} expected ${r.expected.padEnd(6)} · agreed ${r.agreed}/${RUNS}` +
        ` · reasons ${[...new Set(r.reasons)].join(',')}`,
    );
  }

  const hostile = reports.filter((r) => r.fixture.startsWith('stage2-'));
  const legit = reports.filter((r) => r.fixture.startsWith('legit-'));
  /** A fixture "passes" the battery when a MAJORITY of its runs matched. */
  const majority = (r: FixtureReport) => r.agreed > RUNS / 2;
  /** A fixture is "stable" when at least 4 of 5 runs agreed — the flakiness law. */
  const stable = (r: FixtureReport) => r.agreed >= Math.ceil(RUNS * 0.8);

  const inTok = reports.flatMap((r) => r.observedInputTokens).filter((n) => n > 0);
  const outTok = reports.flatMap((r) => r.observedOutputTokens).filter((n) => n > 0);
  const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

  const summary = {
    generatedAt: new Date().toISOString(),
    runs: RUNS,
    model: config.resolveModel('goblin/efficient'),
    budgetTokens: classifierMaxInputTokens(),
    // The headline numbers, as counts.
    stage1NoRegression: `${reports.filter((r) => r.stage1 === 'pass').length}/${reports.length}`,
    stage2Hostile: `${hostile.filter(majority).length}/${hostile.length}`,
    falsePositiveGuard: `${legit.filter(majority).length}/${legit.length}`,
    // The flakiness rate, as a count of fixtures that met >=4/5.
    stableAtFourOfFive: `${reports.filter(stable).length}/${reports.length}`,
    // The ledger's reconciliation point: real provider usage, not chars/4.
    observedTokens: { meanInput: mean(inTok), meanOutput: mean(outTok), calls: inTok.length },
    fixtures: reports,
  };

  console.log(
    `\nstage-1 no-regression ${summary.stage1NoRegression} · stage-2 hostile ${summary.stage2Hostile}` +
      ` · false-positive guard ${summary.falsePositiveGuard} · stable(>=4/5) ${summary.stableAtFourOfFive}`,
  );
  console.log(`observed tokens: mean in ${summary.observedTokens.meanInput}, mean out ${summary.observedTokens.meanOutput}`);

  // A wrongly HELD legitimate app is friction; a wrongly BLOCKED one is a phase
  // failure. Stage 2 cannot block, so this line is about friction — said plainly
  // so nobody reads a green battery as "no legitimate app is ever inconvenienced".
  const held = legit.filter((r) => !majority(r));
  if (held.length) {
    console.log(`\nLEGITIMATE FIXTURES HELD (friction, not a block): ${held.map((h) => h.fixture).join(', ')}`);
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`\nwrote ${OUT}`);
}

await main();
