/**
 * AKT 2 · PHASE 5 · U5.6 — run the induced-failure proof and write the evidence.
 *
 *     pnpm --filter @goblin/api keeper:induced-failure
 *
 * A thin runner. All the logic lives in `src/services/ops-check-induced-failure.ts`
 * so it is typechecked with the rest of the API and runs in CI as
 * `ops-check-induced-failure.test.ts` — a harness that only ever ran when somebody
 * remembered to run it is a harness that rots.
 *
 * Offline and deterministic: a local HTTP server, an in-memory store, an advancing
 * clock. It touches no Cloudflare account, no Supabase project, no real app, and
 * emphatically not `anmeldeformular.justgoblin.app`.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInducedFailureProof } from '../src/services/ops-check-induced-failure';

// The runner reads its own gate at every tick, and the harness drives the real
// runner — so without this the proof would correctly measure nothing at all.
process.env.OPS_HOSTING_ENABLED = 'true';

const OUT_DIR = resolve(import.meta.dirname, '../../../evidence/akt2-phase5');

const report = await runInducedFailureProof({ runs: 3 });

mkdirSync(OUT_DIR, { recursive: true });
// `.json`, not `.txt` — `.gitignore:2` is `*.txt` and has swallowed evidence
// before (carry-forward E1). Written as JSON so the numbers are re-readable
// rather than re-typed.
writeFileSync(resolve(OUT_DIR, 'induced-failure.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const line = (label: string, xs: number[]) => `${label}: ${xs.join(' · ')}`;

console.log('AKT 2 · PHASE 5 · U5.6 — induzierter Ausfall');
console.log(`Takt: alle ${report.cadenceMinutes} Minuten · Frische-Schwelle: ${report.freshnessMs / 60_000} Minuten`);
console.log(line('Zyklen bis zum ersten Signal (degraded)', report.summary.cyclesToFirstSignal));
console.log(line('Zyklen bis "nicht erreichbar" (down)   ', report.summary.cyclesToDown));
console.log(line('Zyklen bis zur Erholung (healthy)      ', report.summary.cyclesToRecover));
console.log(`Alle Läufe stimmen überein: ${report.consistent ? 'ja' : 'NEIN'}`);
console.log(
  `UNBEKANNT-Pfad: laufend=${report.unknownPath.whileRunning} · pausiert=${report.unknownPath.whilePaused}` +
    ` (${report.unknownPath.pausedReason}) · nach Wiederaufnahme=${report.unknownPath.afterResume}`,
);
console.log(`Geschrieben: ${resolve(OUT_DIR, 'induced-failure.json')}`);

// A harness that reports a failure as a success is worse than no harness.
if (!report.consistent || report.unknownPath.whilePaused !== 'unknown') {
  console.error('GATE NICHT ERFÜLLT — siehe die JSON-Datei.');
  process.exit(1);
}
