// Sprint 10.9-4 — Founder weekly digest (Discord, branch-aware content).
//
// Composed from catalog_sync_log + provider_health_events over the past week.
// Posted to DISCORD_OPS_WEBHOOK_URL; if that is unset, written to a file under
// sprint-10-9/ as evidence (never fails). OPTION B: there is no litellm library,
// so the digest reports "catalog source: per-user provider-discovery" with no
// library-version line.

import { getSupabaseAdmin } from '../lib/supabase';
import { getSuspectSlugs } from './provider-health';

export interface DigestResult {
  ok: boolean;
  delivery: 'discord' | 'file' | 'none';
  weekStart: string;
  weekEnd: string;
  body: string;
  reason?: string;
}

interface SyncLogRow {
  synced_at: string;
  source: string;
  added: number | null;
  updated: number | null;
  deactivated: number | null;
  details: Record<string, unknown> | null;
}

interface HealthRow {
  provider: string;
  state: string;
  error_rate: number | null;
  ts: string;
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Minutes a provider spent degraded/down in the window (pairs transitions). */
function degradedMinutes(events: HealthRow[], windowEnd: number): Record<string, number> {
  const byProvider: Record<string, HealthRow[]> = {};
  for (const e of events) (byProvider[e.provider] ??= []).push(e);
  const out: Record<string, number> = {};
  for (const [provider, evs] of Object.entries(byProvider)) {
    evs.sort((a, b) => +new Date(a.ts) - +new Date(b.ts));
    let downSince: number | null = null;
    let ms = 0;
    for (const e of evs) {
      const t = +new Date(e.ts);
      if (e.state !== 'healthy' && downSince === null) downSince = t;
      else if (e.state === 'healthy' && downSince !== null) { ms += t - downSince; downSince = null; }
    }
    if (downSince !== null) ms += windowEnd - downSince;
    if (ms > 0) out[provider] = Math.round(ms / 60000);
  }
  return out;
}

export async function buildDigest(): Promise<{ weekStart: Date; weekEnd: Date; body: string; actionRequired: boolean }> {
  const supabase = getSupabaseAdmin();
  const weekEnd = new Date();
  const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startIso = weekStart.toISOString();

  const [{ data: syncRows }, { data: healthRows }] = await Promise.all([
    supabase.from('catalog_sync_log').select('synced_at, source, added, updated, deactivated, details')
      .gte('synced_at', startIso).order('synced_at', { ascending: false }).then((r) => ({ data: (r.data ?? []) as SyncLogRow[] })),
    supabase.from('provider_health_events').select('provider, state, error_rate, ts')
      .gte('ts', startIso).order('ts', { ascending: true }).then((r) => ({ data: (r.data ?? []) as HealthRow[] })),
  ]).catch(() => [{ data: [] as SyncLogRow[] }, { data: [] as HealthRow[] }] as const);

  const sync = syncRows ?? [];
  const health = healthRows ?? [];

  const totals = sync.reduce(
    (acc, r) => {
      acc.added += r.added ?? 0;
      acc.updated += r.updated ?? 0;
      acc.deactivated += r.deactivated ?? 0;
      return acc;
    },
    { added: 0, updated: 0, deactivated: 0 },
  );

  // BYOK side from the most recent refresh details.
  const latest = sync[0]?.details as
    | { keysValidated?: number; keysInvalid?: number; keysRateLimited?: number }
    | undefined;

  const incidents = health.filter((e) => e.state !== 'healthy');
  const minutes = degradedMinutes(health, weekEnd.getTime());
  const suspects = getSuspectSlugs();

  const actionRequired = totals.deactivated > 0 || suspects.length > 0 || incidents.length > 0;

  const lines: string[] = [];
  lines.push(`**🗓️ Goblin Ops — Wochenreport ${fmt(weekStart)} → ${fmt(weekEnd)}**`);
  lines.push('');
  lines.push('**Katalog-Quelle:** per-user Provider-Discovery (kein LiteLLM-Proxy, kein Library-Version-Bump — OPTION B)');
  lines.push('');
  lines.push('**Katalog-Änderungen (Woche)**');
  lines.push(`• Modelle neu entdeckt: **${totals.added}**`);
  lines.push(`• Keys re-validiert: **${totals.updated}**`);
  lines.push(`• Keys jetzt ungültig (markiert, NICHT gelöscht): **${totals.deactivated}**`);
  if (latest) {
    lines.push(
      `• Letzter Refresh: validiert ${latest.keysValidated ?? 0}, ungültig ${latest.keysInvalid ?? 0}, rate-limited ${latest.keysRateLimited ?? 0}`,
    );
  }
  lines.push('');
  lines.push('**Provider-Health**');
  if (incidents.length === 0) {
    lines.push('• Keine Vorfälle. Alle Provider stabil. ✅');
  } else {
    const seen = new Set<string>();
    for (const e of incidents) {
      if (seen.has(e.provider)) continue;
      seen.add(e.provider);
      const mins = minutes[e.provider] ?? 0;
      lines.push(`• **${e.provider}**: ${e.state} · ~${mins} min degradiert diese Woche`);
    }
  }
  if (suspects.length > 0) {
    lines.push('');
    lines.push('**⚠️ Slug-Failures (Routing abgelehnt — Discovery-Slug prüfen)**');
    for (const s of suspects.slice(0, 10)) {
      lines.push(`• \`${s.slug}\` — ${s.count}×`);
    }
  }
  lines.push('');
  lines.push(`**Action required:** ${actionRequired ? '⚠️ Review (siehe oben — ungültige Keys / Slug-Failures / Vorfälle)' : 'NONE ✅'}`);

  return { weekStart, weekEnd, body: lines.join('\n'), actionRequired };
}

export async function sendDigest(opts: { test?: boolean } = {}): Promise<DigestResult> {
  const { weekStart, weekEnd, body } = await buildDigest();
  const payloadBody = (opts.test ? '**[TEST]**\n' : '') + body;
  const webhook = process.env.DISCORD_OPS_WEBHOOK_URL;

  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: payloadBody.slice(0, 1900) }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok || res.status === 204) {
        return { ok: true, delivery: 'discord', weekStart: fmt(weekStart), weekEnd: fmt(weekEnd), body: payloadBody };
      }
      // fall through to file on non-2xx
    } catch { /* fall through to file */ }
  }

  // File fallback (also covers no-webhook): write evidence, never fail.
  try {
    const { writeFile, mkdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const dir = join(process.cwd(), 'sprint-10-9');
    await mkdir(dir, { recursive: true }).catch(() => {});
    const file = join(dir, `digest-${fmt(weekEnd)}.md`);
    await writeFile(file, payloadBody, 'utf8');
    return {
      ok: true,
      delivery: 'file',
      weekStart: fmt(weekStart),
      weekEnd: fmt(weekEnd),
      body: payloadBody,
      reason: webhook ? 'Discord delivery failed — wrote file fallback' : 'DISCORD_OPS_WEBHOOK_URL unset — wrote file fallback (founder: create the webhook)',
    };
  } catch (err) {
    return {
      ok: false,
      delivery: 'none',
      weekStart: fmt(weekStart),
      weekEnd: fmt(weekEnd),
      body: payloadBody,
      reason: err instanceof Error ? err.message : 'digest delivery failed',
    };
  }
}
