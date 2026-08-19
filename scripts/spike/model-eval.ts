/**
 * SPIKE ONLY — throwaway harness for docs/SPIKE_MODEL_EVAL_2026-08.md.
 *
 * DELETE ME once the founder has read the report. Nothing in production imports
 * this file, and this file imports NOTHING from Goblin production code — not the
 * provider client, not the router, not the pricing table. That independence is
 * deliberate: the harness must be incapable of perturbing (or of being flattered
 * by) the code path it is measuring.
 *
 * What it does
 *   run   → 4 models × 8 probes × 3 repetitions = 96 calls against DeepInfra's
 *           OpenAI-compatible endpoint — one strictly sequential lane per model,
 *           the four lanes running concurrently — writing raw results to
 *           scripts/spike/results.json (gitignored — the report carries the summary).
 *   grade → replays results.json through deterministic, parser-backed checks and
 *           prints the tables the report quotes.
 *
 * Prices are NOT hardcoded. They are read live from DeepInfra's model metadata at
 * the start of `run` and stored inside results.json, so every $ figure in the
 * report traces to a provider response, not to a blog post.
 *
 * Hard budget ceiling: $2.00. The runner tracks estimated spend from each
 * response's usage object and aborts the moment the running total would pass it.
 *
 * Usage
 *   export DEEPINFRA_API_KEY=...
 *   # parsers live OUTSIDE the repo so package.json / pnpm-lock.yaml stay untouched:
 *   npm install --prefix /tmp/goblin-spike-parsers parse5@7 typescript@5
 *   node --experimental-strip-types scripts/spike/model-eval.ts run
 *   node --experimental-strip-types scripts/spike/model-eval.ts grade
 */

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROBES_PATH = join(HERE, 'probes.json');
const RESULTS_PATH = join(HERE, 'results.json');

// ── Knobs (identical for all four models — that is the point) ────────────────
const BASE_URL = process.env.DEEPINFRA_BASE_URL ?? 'https://api.deepinfra.com/v1/openai';
const TEMPERATURE = 0.2;
const MAX_TOKENS = 8096;  // production parity (GOBLIN_MAX_TOKENS_PER_REQUEST, goblin-hosted.ts:179)
const REPETITIONS = 3;
const DELAY_MS = 700;      // be a polite neighbour; do not hammer the provider
const BUDGET_USD = 2.0;    // hard ceiling (spike rule R6)
const MAX_THROTTLE_BACKOFFS = 6; // 429 "model busy" is provider capacity, not a probe failure
const HARD_CALL_TIMEOUT_MS = 900_000; // 15 min — generous enough that a slow model is measured, not truncated by us

/** The four models under test. Slugs were resolved from DeepInfra's live model
 *  list, never from memory. The two `current` entries are what the repo actually
 *  ships today (apps/api/src/services/goblin-hosted.ts:54-55). */
const MODELS = [
  { key: 'swift_current',   tier: 'Swift', role: 'current',   slug: 'deepseek-ai/DeepSeek-V3.2' },
  { key: 'swift_candidate', tier: 'Swift', role: 'candidate', slug: 'deepseek-ai/DeepSeek-V4-Flash-0731' },
  { key: 'forge_current',   tier: 'Forge', role: 'current',   slug: 'moonshotai/Kimi-K2.6' },
  { key: 'forge_candidate', tier: 'Forge', role: 'candidate', slug: 'moonshotai/Kimi-K2.7-Code' },
] as const;

interface Probe { id: string; kind: string; check: string; prompt: string }
interface Price { input: number | null; output: number | null; cache_read: number | null; context_length: number | null }
interface CallRecord {
  model_key: string; slug: string; probe: string; run: number;
  ok: boolean; error: string | null; attempts: number; throttles: number;
  latency_ms: number; ttft_ms: number | null; finish_reason: string | null;
  prompt_tokens: number | null; completion_tokens: number | null; cached_tokens: number | null;
  raw_usage: unknown; text: string;
}
interface Results {
  meta: {
    started_at: string; finished_at: string | null; base_url: string;
    temperature: number; max_tokens: number; repetitions: number;
    halted: boolean; halt_reason: string | null; estimated_spend_usd: number; lanes: number;
  };
  prices: Record<string, Price>;
  calls: CallRecord[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const loadProbes = (): Probe[] => JSON.parse(readFileSync(PROBES_PATH, 'utf8')).probes;

// ── Live price lookup (spike rule R5: prices come from DeepInfra, not the web) ──
async function fetchPrices(apiKey: string): Promise<Record<string, Price>> {
  const res = await fetch(`${BASE_URL}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`model list failed: HTTP ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { data: Array<{ id: string; metadata?: Record<string, any> }> };
  const out: Record<string, Price> = {};
  for (const m of MODELS) {
    const hit = body.data.find((d) => d.id === m.slug);
    if (!hit) throw new Error(`HALT: ${m.slug} is not available on DeepInfra`);
    const p = hit.metadata?.pricing ?? {};
    out[m.slug] = {
      input: p.input_tokens ?? null,
      output: p.output_tokens ?? null,
      cache_read: p.cache_read_tokens ?? null,
      context_length: hit.metadata?.context_length ?? null,
    };
  }
  return out;
}

function costOf(price: Price | undefined, prompt: number, cached: number, completion: number): number {
  if (!price || price.input == null || price.output == null) return 0;
  const uncached = Math.max(0, prompt - cached);
  const cacheRate = price.cache_read ?? price.input;
  return (uncached * price.input + cached * cacheRate + completion * price.output) / 1_000_000;
}

// ── One call, one retry, never a silent drop ────────────────────────────────
/**
 * Streamed, on purpose — two reasons, both about not lying with the numbers:
 *   1. Production streams (`realGoblinClient`, goblin-hosted.ts), so this is the
 *      shape the models are actually asked to work in.
 *   2. Non-streamed, a 4-minute answer holds the socket with no headers and trips
 *      undici's 300s headers timeout. That surfaced as `fetch failed` on the SLOWEST
 *      model — i.e. the harness would have scored the current Swift model as failing
 *      probes it never got to answer, biasing the whole comparison toward the
 *      candidate. Streaming makes headers arrive immediately and the timeout moot.
 * Streaming also gives time-to-first-token for free, which for a chat product is the
 * latency the user actually feels.
 */
async function callOnce(apiKey: string, slug: string, prompt: string) {
  const started = Date.now();
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: slug,
      messages: [{ role: 'user', content: prompt }],
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      stream: true,
      stream_options: { include_usage: true },
    }),
    signal: AbortSignal.timeout(HARD_CALL_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text();
    throw Object.assign(new Error(`HTTP ${res.status}: ${body.slice(0, 400)}`), {
      latency: Date.now() - started,
      status: res.status,
      retryAfter: Number(res.headers.get('retry-after')) || null,
    });
  }
  if (!res.body) throw Object.assign(new Error('no response body'), { latency: Date.now() - started });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '', text = '', finish: string | null = null, usage: any = null, ttft: number | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') continue;
      let chunk: any;
      try { chunk = JSON.parse(payload); } catch { continue; }
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) { if (ttft === null) ttft = Date.now() - started; text += delta; }
      if (chunk.choices?.[0]?.finish_reason) finish = chunk.choices[0].finish_reason;
      if (chunk.usage) usage = chunk.usage;
    }
  }
  return { latency_ms: Date.now() - started, ttft_ms: ttft, finish_reason: finish, text, usage };
}

async function run() {
  const apiKey = process.env.DEEPINFRA_API_KEY;
  if (!apiKey) throw new Error('HALT: DEEPINFRA_API_KEY is not set');
  const probes = loadProbes();
  const prices = await fetchPrices(apiKey);

  const results: Results = {
    meta: {
      started_at: new Date().toISOString(), finished_at: null, base_url: BASE_URL,
      temperature: TEMPERATURE, max_tokens: MAX_TOKENS, repetitions: REPETITIONS,
      halted: false, halt_reason: null, estimated_spend_usd: 0, lanes: MODELS.length,
    },
    prices,
    calls: [],
  };
  const flush = () => writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));

  // One sequential LANE per model, lanes running concurrently. Within a lane the
  // calls are strictly sequential with a delay, so no single model endpoint is ever
  // hammered — the concurrency is only across four different endpoints. Without this
  // the sweep is a ~5h serial job (measured: ~250s for a single 4k-token answer),
  // which is long enough that a container reclaim, not the evidence, decides the result.
  let spend = 0;
  let halted = false;
  const lane = async (m: typeof MODELS[number]) => {
    for (const probe of probes) {
      for (let run = 1; run <= REPETITIONS; run++) {
        if (halted) return;
        let rec: CallRecord;
        let attempts = 0;   // real attempts: one call + at most one retry
        let throttles = 0;  // 429 "model busy" backoffs — provider capacity, NOT model quality
        for (;;) {
          attempts++;
          try {
            const r = await callOnce(apiKey, m.slug, probe.prompt);
            const u = r.usage ?? {};
            rec = {
              model_key: m.key, slug: m.slug, probe: probe.id, run,
              ok: true, error: null, attempts, throttles,
              latency_ms: r.latency_ms, ttft_ms: r.ttft_ms, finish_reason: r.finish_reason,
              prompt_tokens: u.prompt_tokens ?? null,
              completion_tokens: u.completion_tokens ?? null,
              cached_tokens: u.prompt_tokens_details?.cached_tokens ?? 0,
              raw_usage: r.usage, text: r.text,
            };
            break;
          } catch (err: any) {
            // A 429 is the provider saying "not now", not the model failing the probe.
            // Counting it as a probe failure would silently turn a capacity blip into a
            // quality verdict, so it gets its own bounded backoff and its own counter —
            // reported separately in the report, never folded into the success rate.
            if (err?.status === 429 && throttles < MAX_THROTTLE_BACKOFFS) {
              throttles++;
              attempts--; // this attempt never reached the model
              await sleep((err.retryAfter ? err.retryAfter * 1000 : 0) || Math.min(60_000, 5_000 * 2 ** (throttles - 1)));
              continue;
            }
            if (attempts < 2) { await sleep(2000); continue; }
            rec = {
              model_key: m.key, slug: m.slug, probe: probe.id, run,
              ok: false, error: String(err?.message ?? err), attempts, throttles,
              latency_ms: err?.latency ?? 0, ttft_ms: null, finish_reason: null,
              prompt_tokens: null, completion_tokens: null, cached_tokens: null,
              raw_usage: null, text: '',
            };
            break;
          }
        }
        spend += costOf(prices[m.slug], rec.prompt_tokens ?? 0, rec.cached_tokens ?? 0, rec.completion_tokens ?? 0);
        results.calls.push(rec);
        results.meta.estimated_spend_usd = Number(spend.toFixed(6));
        flush();
        process.stdout.write(
          `${m.key.padEnd(16)} ${probe.id} run${run} ` +
          `${rec.ok ? `${rec.finish_reason} ${rec.completion_tokens}out ${rec.latency_ms}ms` : `FAIL ${rec.error?.slice(0, 60)}`} ` +
          `${rec.throttles ? `[${rec.throttles}×429] ` : ''}` +
          `| $${spend.toFixed(4)}\n`,
        );
        if (spend > BUDGET_USD) {
          halted = true;
          results.meta.halted = true;
          results.meta.halt_reason = `budget ceiling $${BUDGET_USD} passed at $${spend.toFixed(4)}`;
          flush();
          return;
        }
        await sleep(DELAY_MS);
      }
    }
  };
  await Promise.all(MODELS.map((m) => lane(m)));
  results.calls.sort((a, b) => a.model_key.localeCompare(b.model_key) || a.probe.localeCompare(b.probe) || a.run - b.run);
  results.meta.finished_at = new Date().toISOString();
  flush();
  console.log(`\ncalls=${results.calls.length} spend=$${spend.toFixed(4)} halted=${results.meta.halted}`);
}

// ── Deterministic grading — parsers, not regex vibe-checks ──────────────────
function loadParsers() {
  const dir = process.env.SPIKE_PARSER_DIR ?? '/tmp/goblin-spike-parsers';
  const req = createRequire(join(dir, 'noop.cjs'));
  try {
    return { parse5: req('parse5'), ts: req('typescript') };
  } catch {
    throw new Error(
      `HALT: parsers not found in ${dir}. Run:\n` +
      `  npm install --prefix ${dir} parse5@7 typescript@5\n` +
      `(installed outside the repo on purpose — package.json and pnpm-lock.yaml must stay untouched)`,
    );
  }
}

/** Pull the largest fenced code block, or fall back to the raw text. */
function extractCode(text: string, langHint?: RegExp): string {
  const blocks = [...text.matchAll(/```([a-zA-Z0-9]*)\n([\s\S]*?)```/g)];
  if (blocks.length === 0) return text;
  const preferred = langHint ? blocks.filter((b) => langHint.test(b[1] ?? '')) : [];
  const pool = preferred.length ? preferred : blocks;
  return pool.reduce((a, b) => ((b[2] ?? '').length > (a[2] ?? '').length ? b : a))[2] ?? text;
}

function walk(node: any, fn: (n: any) => void) {
  if (!node || typeof node !== 'object') return;
  fn(node);
  for (const child of node.childNodes ?? []) walk(child, fn);
}

/** P1/P2: does it parse as HTML and carry the elements the prompt asked for? */
function checkHtml(text: string, needPersistence: boolean, minInputs: number, parse5: any) {
  const html = extractCode(text, /^html?$/i);
  if (!/<html[\s>]/i.test(html) && !/<!doctype/i.test(html)) {
    return { pass: false, why: 'no html document in the answer' };
  }
  const doc = parse5.parse(html);
  let inlineScript = '', styleEls = 0, inputs = 0, externalRefs = 0, hasBody = false;
  walk(doc, (n) => {
    const tag = n.nodeName;
    if (tag === 'body') hasBody = true;
    if (tag === 'style') styleEls++;
    if (tag === 'input' || tag === 'textarea' || tag === 'select') inputs++;
    if (tag === 'script') {
      const src = (n.attrs ?? []).find((a: any) => a.name === 'src');
      if (src) externalRefs++;
      else inlineScript += (n.childNodes ?? []).map((c: any) => c.value ?? '').join('');
    }
    if (tag === 'link') {
      const rel = (n.attrs ?? []).find((a: any) => a.name === 'rel')?.value ?? '';
      const href = (n.attrs ?? []).find((a: any) => a.name === 'href')?.value ?? '';
      if (/stylesheet/i.test(rel) && /^https?:|^\/\//i.test(href)) externalRefs++;
    }
  });
  const fails: string[] = [];
  if (!hasBody) fails.push('no <body>');
  if (!styleEls) fails.push('no embedded <style>');
  if (!inlineScript.trim()) fails.push('no inline <script>');
  if (inputs < minInputs) fails.push(`only ${inputs} input element(s), need ${minInputs}`);
  if (externalRefs > 0) fails.push(`${externalRefs} external library reference(s)`);
  if (needPersistence && !/localStorage|indexedDB|sessionStorage/.test(inlineScript)) {
    fails.push('no browser persistence API in the script');
  }
  return { pass: fails.length === 0, why: fails.join('; ') || 'ok' };
}

/** P6: does the returned code parse (as TSX, so JSX is fair game) and use useReducer? */
function checkJs(text: string, ts: any) {
  const code = extractCode(text, /^(jsx?|tsx?|javascript|typescript|react)$/i);
  const sf = ts.createSourceFile('probe.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const diags = (sf as any).parseDiagnostics ?? [];
  const fails: string[] = [];
  if (diags.length) fails.push(`${diags.length} syntax error(s): ${ts.flattenDiagnosticMessageText(diags[0].messageText, ' ')}`);
  if (!/\buseReducer\b/.test(code)) fails.push('no useReducer in the returned code');
  return { pass: fails.length === 0, why: fails.join('; ') || 'ok' };
}

/** P4: strict JSON on the FIRST attempt — no fence-stripping, no repair, no partial credit. */
function checkJson(text: string) {
  let obj: any;
  try { obj = JSON.parse(text.trim()); } catch (e: any) { return { pass: false, why: `not JSON: ${e.message.slice(0, 60)}` }; }
  const fails: string[] = [];
  const keys = Object.keys(obj ?? {}).sort();
  if (keys.join(',') !== 'features,name,version') fails.push(`keys are [${keys.join(',')}]`);
  if (typeof obj?.name !== 'string') fails.push('name not a string');
  if (typeof obj?.version !== 'string') fails.push('version not a string');
  if (!Array.isArray(obj?.features) || obj.features.length !== 3 || !obj.features.every((f: any) => typeof f === 'string')) {
    fails.push('features is not exactly three strings');
  }
  return { pass: fails.length === 0, why: fails.join('; ') || 'ok' };
}

/** P3: does the answer's corrected code actually pass reduce an initial accumulator? */
function checkReduceFix(text: string, ts: any) {
  const code = extractCode(text, /^(jsx?|tsx?|javascript|typescript)$/i);
  const sf = ts.createSourceFile('fix.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let found = false;
  const visit = (n: any) => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.escapedText === 'reduce' &&
      n.arguments.length >= 2
    ) found = true;
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);
  return { pass: found, why: found ? 'reduce called with an initial value' : 'no reduce(fn, initial) in the answer' };
}

function grade() {
  if (!existsSync(RESULTS_PATH)) throw new Error(`HALT: ${RESULTS_PATH} missing — run the harness first`);
  const { parse5, ts } = loadParsers();
  const results: Results = JSON.parse(readFileSync(RESULTS_PATH, 'utf8'));
  const probes = loadProbes();

  const perCall = results.calls.map((c) => {
    const truncated = c.finish_reason !== 'stop';
    let check = { pass: !truncated && c.ok && c.text.trim().length > 0, why: truncated ? `finish_reason=${c.finish_reason}` : 'completed' };
    if (c.ok && !truncated) {
      const kind = probes.find((p) => p.id === c.probe)!.check;
      // P1 names three fields (Datum, Distanz, Dauer) → ≥3 static inputs is fair.
      // P2 is a shopping list: ONE text box is the correct design — the per-item
      // checkboxes are created by JS at runtime and are not in the static markup.
      // The first version of this check demanded ≥2 for both and failed P2 on all
      // four models; that was the check being wrong, not the models.
      if (kind === 'html') check = checkHtml(c.text, false, 3, parse5);
      else if (kind === 'html-persist') check = checkHtml(c.text, true, 1, parse5);
      else if (kind === 'strict-json') check = checkJson(c.text);
      else if (kind === 'js-parses') check = checkJs(c.text, ts);
      else if (kind === 'reduce-initial-value') check = checkReduceFix(c.text, ts);
    } else if (!c.ok) {
      check = { pass: false, why: `call failed: ${c.error?.slice(0, 60)}` };
    }
    const price = results.prices[c.slug];
    return {
      ...c, truncated, pass: check.pass, why: check.why,
      cost_usd: costOf(price, c.prompt_tokens ?? 0, c.cached_tokens ?? 0, c.completion_tokens ?? 0),
    };
  });

  const summary: any = { config: results.meta, prices: results.prices, models: {} };
  for (const m of MODELS) {
    const mine = perCall.filter((c) => c.model_key === m.key);
    const probeRows: any = {};
    let probesPassed = 0;
    // P6 is VOID as a refactor probe — see the report. Its prompt ends 'Der Code kommt
    // gleich' but no code is ever sent, so a deterministic PASS rewards inventing a
    // component the model was never shown. Kept in the table for transparency, and
    // also reported as a corrected rate over the 7 probes that actually test what
    // they claim to test.
    let voidProbePasses = 0;
    for (const p of probes) {
      const runs = mine.filter((c) => c.probe === p.id);
      const passes = runs.filter((c) => c.pass).length;
      // A probe counts as PASS for the model when the MAJORITY of its 3 runs pass.
      const verdict = passes >= Math.ceil(runs.length / 2);
      if (verdict) probesPassed++;
      if (p.id === 'P6') voidProbePasses = verdict ? 1 : 0;
      probeRows[p.id] = {
        passes: `${passes}/${runs.length}`, verdict: verdict ? 'PASS' : 'FAIL',
        truncated: runs.filter((c) => c.truncated).length,
        reasons: [...new Set(runs.filter((c) => !c.pass).map((c) => c.why))],
        mean_in: Math.round(avg(runs.map((c) => c.prompt_tokens ?? 0))),
        mean_out: Math.round(avg(runs.map((c) => c.completion_tokens ?? 0))),
        mean_latency_ms: Math.round(avg(runs.map((c) => c.latency_ms))),
        mean_ttft_ms: Math.round(avg(runs.filter((c) => c.ttft_ms != null).map((c) => c.ttft_ms!))),
        cost_usd_per_run: Number(avg(runs.map((c) => c.cost_usd)).toFixed(6)),
      };
    }
    const okRuns = mine.filter((c) => c.ok);
    const totalIn = sum(okRuns.map((c) => c.prompt_tokens ?? 0));
    const totalOut = sum(okRuns.map((c) => c.completion_tokens ?? 0));
    const price = results.prices[m.slug]!;
    const ratio = totalOut === 0 ? null : totalIn / totalOut;
    summary.models[m.key] = {
      slug: m.slug, tier: m.tier, role: m.role,
      success_rate: `${probesPassed}/${probes.length}`,
      success_rate_excluding_void_P6: `${probesPassed - voidProbePasses}/${probes.length - 1}`,
      probes: probeRows,
      calls: mine.length, failed_calls: mine.filter((c) => !c.ok).length,
      truncated_calls: mine.filter((c) => c.truncated).length,
      // provider capacity, reported separately from quality (see the 429 note in run())
      throttled_calls: mine.filter((c) => (c.throttles ?? 0) > 0).length,
      total_429_backoffs: sum(mine.map((c) => c.throttles ?? 0)),
      total_input_tokens: totalIn, total_output_tokens: totalOut,
      measured_in_out_ratio: ratio ? Number(ratio.toFixed(2)) : null,
      mean_latency_ms: Math.round(avg(okRuns.map((c) => c.latency_ms))),
      p90_latency_ms: pct(okRuns.map((c) => c.latency_ms), 0.9),
      mean_ttft_ms: Math.round(avg(okRuns.filter((c) => c.ttft_ms != null).map((c) => c.ttft_ms!))),
      p90_ttft_ms: pct(okRuns.filter((c) => c.ttft_ms != null).map((c) => c.ttft_ms!), 0.9),
      cost_full_probe_set_usd: Number((sum(mine.map((c) => c.cost_usd)) / results.meta.repetitions).toFixed(6)),
      cost_total_usd: Number(sum(mine.map((c) => c.cost_usd)).toFixed(6)),
      // blended $/M at the ratio this harness actually measured, not at an assumed 9:1
      blended_per_m_at_measured_ratio: ratio == null ? null
        : Number(((ratio * price.input! + price.output!) / (ratio + 1)).toFixed(4)),
      blended_per_m_at_9to1: Number(((9 * price.input! + price.output!) / 10).toFixed(4)),
    };
  }
  const b = (k: string) => summary.models[k].blended_per_m_at_measured_ratio;
  const b9 = (k: string) => summary.models[k].blended_per_m_at_9to1;
  summary.ratios = {
    current_pair_measured: Number((b('forge_current') / b('swift_current')).toFixed(2)),
    candidate_pair_measured: Number((b('forge_candidate') / b('swift_candidate')).toFixed(2)),
    current_pair_at_9to1: Number((b9('forge_current') / b9('swift_current')).toFixed(2)),
    candidate_pair_at_9to1: Number((b9('forge_candidate') / b9('swift_candidate')).toFixed(2)),
    shipped_FORGE_WEIGHT: 4.4,
  };
  summary.total_spend_usd = Number(sum(perCall.map((c) => c.cost_usd)).toFixed(6));
  console.log(JSON.stringify(summary, null, 2));
}

const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
const pct = (xs: number[], q: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor(q * s.length))]!);
};

const mode = process.argv[2];
if (mode === 'run') await run();
else if (mode === 'grade') grade();
else { console.error('usage: model-eval.ts <run|grade>'); process.exit(1); }
