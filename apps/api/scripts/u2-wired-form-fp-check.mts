/**
 * FOUNDER-WALK-6 · U2 (F2) — real-model before/after for the two live false
 * positives (chess-course signup form, guitar-teacher contact page).
 *
 * Reconstructs both pages as a builder would have written them (a plain form,
 * no `action`), runs them through the REAL `wireForms()` to get the actual
 * wired bytes stage 2 used to see, then classifies FIVE times each:
 *
 *   BEFORE — classifyArtifact(wiredFiles)                    — the old call
 *   AFTER  — classifyArtifact(preWiringFiles, undefined, N)  — ops-publish.ts's
 *                                                                new call
 *
 * Same "flakiness law" as the Phase-3 battery script: one sample proves
 * nothing about a model, so each case runs 5 times and the count is reported
 * as a count, not a grade.
 *
 * Usage:
 *   cd apps/api
 *   GOBLIN_HOSTED_API=true DEEPINFRA_API_KEY=… pnpm exec tsx scripts/u2-wired-form-fp-check.mts [runs]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyArtifact, extractCandidateText } from '../src/services/safety/abuse-classifier.js';
import { getGoblinHostedConfig } from '../src/services/goblin-hosted.js';
import { scanHostedArtifact, type HostedScanFile } from '../src/services/safety/hosted-publish-scan.js';
import { wireForms } from '../src/services/ops-form-wiring.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 5;
const OUT = resolve(HERE, '../../../evidence/founder-walk-6/u2-wired-form-fp-check.json');

const WIRE_OPTS = { endpoint: 'https://api.justgoblin.app', siteKey: '0x4AAAAAAA_test_sitekey' };

// ── Reconstructions of the two 2026-08-15 walk incidents ────────────────────
// Ordinary pages a builder would ask Goblin for. Neither form has an `action`
// — the default for an AI-generated form, and the trigger for wireForms().

const CHESS_SIGNUP_HTML = `<!doctype html>
<html lang="de">
<head><meta charset="utf-8"><title>Schachkurs für Einsteiger</title></head>
<body>
  <header><h1>Schachkurs für Einsteiger</h1></header>
  <main>
    <p>Acht Abende, kleine Gruppen, alle Spielstärken willkommen. Der Kurs
       beginnt am 3. September im Vereinsheim.</p>
    <section>
      <h2>Anmeldung</h2>
      <form id="anmeldung">
        <label for="name">Name</label>
        <input id="name" name="name" type="text" required>
        <label for="email">E-Mail</label>
        <input id="email" name="email" type="email" required>
        <label for="erfahrung">Spielerfahrung</label>
        <select id="erfahrung" name="erfahrung">
          <option>Anfänger</option>
          <option>Fortgeschritten</option>
        </select>
        <button type="submit">Anmelden</button>
      </form>
    </section>
  </main>
</body>
</html>`;

const GUITAR_CONTACT_HTML = `<!doctype html>
<html lang="de">
<head><meta charset="utf-8"><title>Gitarrenunterricht bei Klaus</title></head>
<body>
  <header><h1>Gitarrenunterricht bei Klaus</h1></header>
  <main>
    <p>Einzelunterricht für Einsteiger und Fortgeschrittene, akustisch oder
       elektrisch, bei mir zu Hause oder online.</p>
    <section>
      <h2>Kontakt</h2>
      <form id="kontakt">
        <label for="name">Dein Name</label>
        <input id="name" name="name" type="text" required>
        <label for="email">Deine E-Mail</label>
        <input id="email" name="email" type="email" required>
        <label for="nachricht">Nachricht</label>
        <textarea id="nachricht" name="nachricht" rows="4"></textarea>
        <button type="submit">Absenden</button>
      </form>
    </section>
  </main>
</body>
</html>`;

interface Case {
  name: string;
  html: string;
}
const CASES: Case[] = [
  { name: 'chess-course-signup (2026-08-15: held phishing/high)', html: CHESS_SIGNUP_HTML },
  { name: 'guitar-teacher-contact (2026-08-15: held circumvention)', html: GUITAR_CONTACT_HTML },
];

interface RunResult {
  verdict: string;
  reason: string;
  categories: string[];
}
interface CaseReport {
  case: string;
  wiredFormCount: number;
  stage1: string;
  before: { runs: RunResult[]; held: number };
  after: { runs: RunResult[]; held: number };
}

async function classifyN(files: HostedScanFile[], wiredFormCount: number, n: number): Promise<RunResult[]> {
  const out: RunResult[] = [];
  for (let i = 0; i < n; i++) {
    const r = await classifyArtifact(files, undefined, wiredFormCount);
    out.push({ verdict: r.verdict, reason: r.reason, categories: r.categories });
  }
  return out;
}

async function main() {
  const config = getGoblinHostedConfig();
  if (!config) {
    console.error('REFUSED: Goblin-hosted inference is not configured (GOBLIN_HOSTED_API / DEEPINFRA_API_KEY).');
    process.exit(2);
  }

  console.log(`U2 (F2) wired-form false-positive check · ${CASES.length} cases × ${RUNS} runs (before) + ${RUNS} runs (after)\n`);

  const reports: CaseReport[] = [];
  for (const c of CASES) {
    const preWiring: HostedScanFile[] = [{ path: 'index.html', content: c.html, bytes: Buffer.byteLength(c.html) }];
    const wiring = wireForms([{ path: 'index.html', bytes: Buffer.from(c.html, 'utf8') }], WIRE_OPTS);
    if (!('files' in wiring)) throw new Error(`wireForms refused: ${wiring.message}`);
    const wiredFiles: HostedScanFile[] = wiring.files.map((f) => ({
      path: f.path,
      content: f.bytes.toString('utf8'),
      bytes: f.bytes.length,
    }));
    const wiredFormCount = wiring.wired.length;

    const stage1 = scanHostedArtifact(wiredFiles);
    console.log(`${c.name}: wired ${wiredFormCount} form(s), stage1=${stage1.verdict}, before-chars=${extractCandidateText(wiredFiles).chars}, after-chars=${extractCandidateText(preWiring).chars}`);

    // BEFORE — the old call: classify the WIRED bytes directly, no note.
    const before = await classifyN(wiredFiles, 0, RUNS);
    // AFTER — the new call, exactly as ops-publish.ts now makes it.
    const after = await classifyN(preWiring, wiredFormCount, RUNS);

    const held = (rs: RunResult[]) => rs.filter((r) => r.verdict === 'review').length;
    const report: CaseReport = {
      case: c.name,
      wiredFormCount,
      stage1: stage1.verdict,
      before: { runs: before, held: held(before) },
      after: { runs: after, held: held(after) },
    };
    reports.push(report);
    console.log(`  BEFORE held ${report.before.held}/${RUNS} · reasons ${[...new Set(before.map((r) => r.reason))].join(',')} · categories ${[...new Set(before.flatMap((r) => r.categories))].join(',') || '(none)'}`);
    console.log(`  AFTER  held ${report.after.held}/${RUNS} · reasons ${[...new Set(after.map((r) => r.reason))].join(',')} · categories ${[...new Set(after.flatMap((r) => r.categories))].join(',') || '(none)'}\n`);
  }

  const totalBefore = reports.reduce((s, r) => s + r.before.held, 0);
  const totalAfter = reports.reduce((s, r) => s + r.after.held, 0);
  const totalRuns = reports.length * RUNS;
  console.log(`TOTAL false-positive holds — BEFORE: ${totalBefore}/${totalRuns} · AFTER: ${totalAfter}/${totalRuns}`);

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    `${JSON.stringify(
      { generatedAt: new Date().toISOString(), runs: RUNS, model: config.resolveModel('goblin/efficient'), totalBefore, totalAfter, totalRuns, cases: reports },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log(`\nwrote ${OUT}`);
}

await main();
