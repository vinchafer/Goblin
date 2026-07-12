// FEEL-3a/3b — the agent tools. Thin adapters over the ALREADY-HARDENED services,
// project-scoped, acting as the run's user. No new capability code:
//   list_files  → code_session_files (hydrated from storage), .trash-excluded (B6)
//   read_file   → session/storage content, size-capped like U1 (over-cap → "zu gross")
//   write_file  → STC draft pipeline: P0.3 integrity check + U2 classify (GEÄNDERT/NEU/
//                 IDENTISCH + line delta) → upsert as a draft row (what the Code
//                 workspace renders with the badge). This classification is what makes
//                 the run's report attestable.
//   save_draft  → the Sichern flow (promote drafts → real storage), idempotent
//   finish      → control-flow, intercepted by the orchestrator (declared here so the
//                 model has its schema; executed as a no-op terminator if ever reached)
//
// Results are structured JSON; errors are structured too. The model may retry the
// SAME tool once (the loop's concern) — here an error simply informs the narration.

import { getSupabaseAdmin } from '../../lib/supabase';
import { getFile, uploadFile, headBytes } from '../file-storage';
import { byteLen, assertStorageRoom } from '../storage-usage';
import { checkProjectPath, isForbiddenWriteTarget, WRITE_FILE_MAX_CHARS } from '../project-path';
import { hitRateLimit } from '../../middleware/rate-limit';
import { publishesPerHour } from '../abuse-caps';
import { isSoftDeletedPath, FILE_CONTENT_BUDGET_CHARS } from '../project-context';
import { classifyFile, lineDelta, checkStcIntegrity } from '@goblin/shared';
import logger from '../../lib/logger';
import {
  runPublish,
  readDeployStatus,
  newPublishState,
  realPublishDeps,
  type PublishDeps,
  type PublishState,
} from './publish';
import { runPublishGuard } from '../safety/publish-scan';
import { listFiles as realListFiles, downloadFile as realDownloadFile } from '../file-storage';
import type { ToolSpec, ToolExecutor, ToolCall, ToolResult, ToolContext } from './types';
import {
  remainingPlatformSearches,
  recordPlatformSearch,
  searchDailyCap,
  agentMaxSearchesPerRun,
  type ResolvedSearch,
} from '../search';

// ─── Tool schemas (native function-calling shape + the fallback JSON contract) ──

export const AGENT_TOOLS: ToolSpec[] = [
  {
    // A-4 (plan mode): control-flow, intercepted by the orchestrator (no service call).
    // The model calls this ONCE, as its FIRST action, only for a mehrschrittige/mehrdeutige
    // Aufgabe — to narrate a short plan before it starts building. It does NOT wait for
    // approval (announce-then-act); the loop emits the plan as a distinct step and the
    // model proceeds straight to the tools. Trivial single edits skip it entirely.
    name: 'plan',
    description:
      'NUR bei einer mehrschrittigen oder mehrdeutigen Aufgabe: nenne als ERSTES einen kurzen Plan ' +
      '(2–5 knappe Schritte), BEVOR du Werkzeuge benutzt. Du wartest NICHT auf Bestätigung — direkt ' +
      'nach dem Plan fängst du an zu bauen. Bei einer einfachen, eindeutigen Einzeländerung rufe plan ' +
      'NICHT auf, sondern handle sofort.',
    parameters: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Die geplanten Schritte, je einer kurz, z.B. ["settings.html anlegen", "Toggle-Logik", "live stellen"]',
        },
      },
      required: ['steps'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_files',
    description:
      'Listet alle Dateien des Projekts (ohne gelöschte). Nutze dies zur Orientierung, ' +
      'bevor du eine Datei liest oder änderst.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'read_file',
    description:
      'Liest den vollständigen Inhalt EINER Datei. Nutze dies, bevor du eine bestehende ' +
      'Datei änderst, damit du den echten aktuellen Code siehst.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Dateipfad, z.B. index.html' } },
      required: ['path'],
      additionalProperties: false,
    },
  },
  {
    name: 'write_file',
    description:
      'Schreibt eine Datei als ENTWURF (wird noch nicht veröffentlicht). Gib den KOMPLETTEN ' +
      'neuen Dateiinhalt an. Das Ergebnis nennt dir die echte Einstufung (NEU / GEÄNDERT +n −m / ' +
      'IDENTISCH) — verwende genau diese Zahlen in deinem Bericht, erfinde keine.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Dateipfad, z.B. index.html' },
        content: { type: 'string', description: 'Der vollständige neue Inhalt der Datei' },
      },
      required: ['path', 'content'],
      additionalProperties: false,
    },
  },
  {
    name: 'save_draft',
    description:
      'Sichert alle offenen Entwürfe (Sichern). Idempotent — mehrfaches Aufrufen schadet nicht. ' +
      'Veröffentlicht NICHT.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'publish',
    description:
      'Veröffentlicht das Projekt (Live stellen): sichert offene Entwürfe, baut und stellt live, und ' +
      'PRÜFT danach, ob die Seite und alle referenzierten Dateien wirklich erreichbar sind. Ergebnis ist ' +
      'ehrlich: bei Erfolg die geprüfte Live-URL, bei einem Fehler die konkret fehlgeschlagene Prüfung ' +
      '(z.B. welche Datei nicht erreichbar ist). Rufe dies NUR auf, wenn der Nutzer das Veröffentlichen ' +
      'ausdrücklich verlangt hat — sonst sichere nur den Entwurf.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'read_deploy_status',
    description:
      'Liest den aktuellen Veröffentlichungs-Status: live (mit URL), nicht veröffentlicht, oder ' +
      'fehlgeschlagen (mit dem letzten Fehler im Wortlaut). Nutze dies nach einem fehlgeschlagenen ' +
      'publish, um zu sehen, was genau schiefging.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'finish',
    description:
      'Beendet den Lauf mit einem kurzen, ehrlichen Bericht auf Deutsch: was du getan hast und ' +
      'in welchem Zustand die Dateien sind. Rufe dies auf, wenn die Aufgabe erledigt ist ODER wenn ' +
      'du sie nicht erfüllen kannst.',
    parameters: {
      type: 'object',
      properties: { report: { type: 'string', description: 'Kurzer Abschlussbericht (Deutsch)' } },
      required: ['report'],
      additionalProperties: false,
    },
  },
];

// F4.3 — web_search is advertised ONLY when a search provider is configured for the
// run (platform key or the user's BYOK Brave key). Declared separately so a run
// without search never sees a tool it can't use (no false capability).
export const WEB_SEARCH_TOOL: ToolSpec = {
  name: 'web_search',
  description:
    'Sucht im Web (aktuelle Fakten, Versionen, Doku). Nutze dies NUR, wenn die Aufgabe ' +
    'echtes Live-Wissen braucht, das nicht im Projekt steht. Gib eine knappe, gezielte ' +
    'Suchanfrage an. Das Ergebnis sind echte Treffer (Titel, URL, Auszug) — wenn du einen ' +
    'gefundenen Fakt verwendest, zitiere die Quelle im Text als „Quelle: <url>". Erfinde ' +
    'niemals Treffer oder URLs. Höchstens wenige Suchen pro Lauf — bündle deine Frage.',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string', description: 'Die Suchanfrage, z.B. "aktuelle stabile Tailwind-Version"' } },
    required: ['query'],
    additionalProperties: false,
  },
};

/** The tool set advertised to a run: base tools, plus web_search when search is available. */
export function agentToolsFor(opts: { search: boolean }): ToolSpec[] {
  return opts.search ? [...AGENT_TOOLS, WEB_SEARCH_TOOL] : AGENT_TOOLS;
}

// ─── Session file helpers (the agent's coherent view of its own edits) ──────────

type Sb = ReturnType<typeof getSupabaseAdmin>;

/** Current session file paths, soft-deleted (.trash) excluded (B6). */
async function listSessionPaths(sb: Sb, sessionId: string): Promise<string[]> {
  const { data } = await sb.from('code_session_files').select('path').eq('session_id', sessionId);
  return (data ?? [])
    .map((r) => r.path as string)
    .filter((p) => p && !isSoftDeletedPath(p))
    .sort();
}

/** Content of one path — the session draft/saved row first, then real storage. */
async function readSessionFile(sb: Sb, ctx: ToolContext, path: string): Promise<string | null> {
  const { data } = await sb
    .from('code_session_files')
    .select('content')
    .eq('session_id', ctx.sessionId)
    .eq('path', path)
    .maybeSingle();
  if (data?.content != null) return data.content as string;
  return getFile(ctx.projectId, path);
}

// D-1 — one honest German error for any structurally-unsafe path (traversal, absolute,
// encoded separator, null byte). Same copy for every reason so a probe can't map the
// guard by the message; the code stays machine-readable.
const UNSAFE_PATH_ERROR = {
  code: 'invalid_path',
  message: 'Ungültiger Dateipfad. Bitte einen einfachen projektinternen Pfad angeben (z.B. index.html oder css/app.css).',
} as const;

// ─── The tool implementations ───────────────────────────────────────────────────

async function toolListFiles(sb: Sb, ctx: ToolContext): Promise<ToolResult> {
  const paths = await listSessionPaths(sb, ctx.sessionId);
  return {
    ok: true,
    summary: paths.length ? `${paths.length} Datei${paths.length === 1 ? '' : 'en'}` : 'keine Dateien',
    data: paths,
  };
}

async function toolReadFile(sb: Sb, ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const raw = typeof args.path === 'string' ? args.path.trim() : '';
  if (!raw) return { ok: false, summary: 'Pfad fehlt', error: { code: 'bad_args', message: 'path erforderlich' } };
  // D-1: canonicalize + reject any path that could escape the project prefix.
  const checked = checkProjectPath(raw);
  if (!checked.ok || !checked.path) {
    return { ok: false, summary: `${raw} · ungültiger Pfad`, error: { ...UNSAFE_PATH_ERROR } };
  }
  const path = checked.path;
  if (isSoftDeletedPath(path)) {
    return { ok: false, summary: `${path} · gelöscht`, error: { code: 'not_found', message: 'Datei ist gelöscht' } };
  }
  const content = await readSessionFile(sb, ctx, path);
  if (content == null) {
    return { ok: false, summary: `${path} · nicht gefunden`, error: { code: 'not_found', message: `${path} existiert nicht` } };
  }
  // U1 size cap: over-cap is an honest tool error ("zu gross"), NEVER a silent truncation.
  if (content.length > FILE_CONTENT_BUDGET_CHARS) {
    return {
      ok: false,
      summary: `${path} · zu gross`,
      error: { code: 'too_large', message: `Datei zu gross (${content.length} Zeichen, Limit ${FILE_CONTENT_BUDGET_CHARS})` },
    };
  }
  return { ok: true, summary: path, data: content };
}

/** Map U2 FileStatus → the user-facing badge label. */
function badge(status: 'new' | 'changed' | 'identical'): 'NEU' | 'GEÄNDERT' | 'IDENTISCH' {
  return status === 'new' ? 'NEU' : status === 'changed' ? 'GEÄNDERT' : 'IDENTISCH';
}

async function toolWriteFile(sb: Sb, ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const raw = typeof args.path === 'string' ? args.path.trim() : '';
  const content = typeof args.content === 'string' ? args.content : '';
  if (!raw) return { ok: false, summary: 'Pfad fehlt', error: { code: 'bad_args', message: 'path erforderlich' } };
  // D-1: canonicalize + reject traversal/absolute/encoded/null-byte paths BEFORE any
  // storage touch, so a run can never write outside its own project prefix.
  const checked = checkProjectPath(raw);
  if (!checked.ok || !checked.path) {
    return { ok: false, summary: `${raw} · ungültiger Pfad`, error: { ...UNSAFE_PATH_ERROR } };
  }
  const path = checked.path;
  // D-1: secret/control files (.env, .git/*, credentials) may never be written into a
  // project — they would leak once deployed or subvert the build. Honest, specific copy.
  if (isForbiddenWriteTarget(path)) {
    return {
      ok: false,
      summary: `${path} · nicht erlaubt`,
      error: {
        code: 'forbidden_file',
        message: 'Diese Datei darf nicht angelegt werden (Secret- oder Plattform-Datei wie .env oder .git). Wähle einen anderen Dateinamen.',
      },
    };
  }
  if (content.length > WRITE_FILE_MAX_CHARS) {
    return { ok: false, summary: `${path} · zu gross`, error: { code: 'too_large', message: `Inhalt über ${WRITE_FILE_MAX_CHARS / 1000}k Zeichen` } };
  }

  // U2 classify against the CURRENT content (real ground truth for the report).
  const existing = await readSessionFile(sb, ctx, path);
  const status = classifyFile(existing, content);
  const delta = status === 'changed' ? lineDelta(existing ?? '', content) : { added: 0, removed: 0 };

  // Upsert as a DRAFT — never direct-to-live (STC draft pipeline invariant).
  const { error } = await sb.from('code_session_files').upsert(
    {
      session_id: ctx.sessionId,
      user_id: ctx.userId,
      path,
      content,
      change_state: 'draft',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'session_id,path' },
  );
  if (error) {
    return { ok: false, summary: `${path} · Fehler`, error: { code: 'write_failed', message: error.message } };
  }
  await sb.from('code_sessions').update({ updated_at: new Date().toISOString() }).eq('id', ctx.sessionId);

  // P0.3 filename-integrity: does the entry HTML now reference files that don't exist?
  // Non-blocking here (the draft is written) — surfaced so the model can self-correct
  // by writing the missing file next.
  let integrityNote: string | undefined;
  try {
    const paths = await listSessionPaths(sb, ctx.sessionId);
    const files = await Promise.all(
      paths.map(async (p) => ({ path: p, content: (await readSessionFile(sb, ctx, p)) ?? '' })),
    );
    const integ = checkStcIntegrity(files);
    if (!integ.ok && integ.missing.length) integrityNote = `Fehlende Referenzen: ${integ.missing.join(', ')}`;
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'agent_write_integrity_check_skipped');
  }

  const label = badge(status);
  const summary =
    label === 'GEÄNDERT' ? `${path} · GEÄNDERT +${delta.added} −${delta.removed}` : `${path} · ${label}`;
  return {
    ok: true,
    summary,
    file: {
      path,
      classification: label,
      ...(label === 'GEÄNDERT' ? { added: delta.added, removed: delta.removed } : {}),
    },
    data: { classification: label, added: delta.added, removed: delta.removed, integrity: integrityNote ?? 'ok' },
  };
}

/**
 * Promote all open drafts of a session to real storage (the Sichern flow). Shared by
 * save_draft and publish (publish must save what the model wrote before deploying it).
 * Returns saved paths + an honest failure reason (storage full / all uploads failed).
 */
async function promoteDrafts(
  sb: Sb,
  ctx: ToolContext,
): Promise<{ ok: boolean; saved: string[]; error?: string; empty?: boolean }> {
  const { data: drafts } = await sb
    .from('code_session_files')
    .select('id, path, content')
    .eq('session_id', ctx.sessionId)
    .eq('change_state', 'draft');

  if (!drafts || drafts.length === 0) return { ok: true, saved: [], empty: true };

  // Storage cap — pre-check the whole batch before any write (mirrors POST /save).
  let aggregateDelta = 0;
  for (const f of drafts) {
    aggregateDelta += byteLen(f.content as string) - (await headBytes(ctx.projectId, f.path as string));
  }
  try {
    await assertStorageRoom(ctx.userId, aggregateDelta);
  } catch (e) {
    return { ok: false, saved: [], error: `Speicher voll: ${(e as Error).message}` };
  }

  const saved: string[] = [];
  for (const f of drafts) {
    try {
      await uploadFile(ctx.projectId, f.path as string, f.content as string, { userId: ctx.userId, enforce: false });
      await sb
        .from('code_session_files')
        .update({ change_state: 'saved', updated_at: new Date().toISOString() })
        .eq('id', f.id);
      saved.push(f.path as string);
    } catch (e) {
      logger.warn({ err: (e as Error).message, path: f.path }, 'agent_save_file_failed');
    }
  }
  await sb.from('code_sessions').update({ updated_at: new Date().toISOString() }).eq('id', ctx.sessionId);
  if (saved.length === 0) return { ok: false, saved: [], error: 'Sichern fehlgeschlagen' };
  return { ok: true, saved };
}

async function toolSaveDraft(sb: Sb, ctx: ToolContext): Promise<ToolResult> {
  const res = await promoteDrafts(sb, ctx);
  if (res.empty) return { ok: true, summary: 'Keine Entwürfe zu sichern', data: { saved: 0 } };
  if (!res.ok) {
    const code = res.error?.startsWith('Speicher voll') ? 'storage_full' : 'save_failed';
    return { ok: false, summary: res.error ?? 'Sichern fehlgeschlagen', error: { code, message: res.error ?? 'Sichern fehlgeschlagen' } };
  }
  return {
    ok: true,
    summary: `${res.saved.length} Datei${res.saved.length === 1 ? '' : 'en'} gesichert ✓`,
    data: { saved: res.saved.length, paths: res.saved },
  };
}

/** Vercel project name — deployToVercel keys off it. Falls back to the id if unnamed. */
async function projectName(sb: Sb, projectId: string): Promise<string> {
  const { data } = await sb.from('projects').select('name').eq('id', projectId).maybeSingle();
  return ((data as { name?: string } | null)?.name ?? projectId) as string;
}

/** Persist the verified URL on the project row (mirrors the deploy route's success write). */
async function markDeployed(sb: Sb, projectId: string, url: string): Promise<void> {
  await sb.from('projects').update({ preview_url: url, last_deployed_at: new Date().toISOString() }).eq('id', projectId);
}

/** read_deploy_status adapter — reads the project row + the run's publish memory. */
async function toolReadDeployStatus(sb: Sb, ctx: ToolContext, state: PublishState): Promise<ToolResult> {
  const { data } = await sb
    .from('projects')
    .select('preview_url, last_deployed_at')
    .eq('id', ctx.projectId)
    .maybeSingle();
  const row = (data as { preview_url?: string | null; last_deployed_at?: string | null } | null) ?? {};
  return readDeployStatus(state, { previewUrl: row.preview_url, lastDeployedAt: row.last_deployed_at });
}

/** Options for the executor — the B1 publish deps + the run's shared publish state. */
export interface ExecutorOptions {
  publishDeps?: PublishDeps;
  publishState?: PublishState;
  /** Injectable sleep for the deploy poll (tests pass a no-op). */
  sleep?: (ms: number) => Promise<void>;
  /** F4.3: the resolved search provider for this run (null → web_search unavailable). */
  search?: ResolvedSearch | null;
  /** F4.3: max web searches this run may make (orchestrator-enforced knob, default 3). */
  maxSearchesPerRun?: number;
}

// F4.3 — the web_search tool. Enforces the per-run cap (counter lives in the run's
// executor closure) and, for platform-key searches, the per-user daily cap. User-key
// searches are cap-exempt. Results are returned as structured hits so the model can
// cite; a provider failure is an honest tool error, never a fabricated result.
async function toolWebSearch(
  ctx: ToolContext,
  args: Record<string, unknown>,
  search: ResolvedSearch | null | undefined,
  state: { used: number; max: number },
  signal?: AbortSignal,
): Promise<ToolResult> {
  const query = typeof args.query === 'string' ? args.query.trim() : '';
  if (!query) return { ok: false, summary: 'Suchanfrage fehlt', error: { code: 'bad_args', message: 'query erforderlich' } };

  if (!search) {
    return {
      ok: false,
      summary: 'Websuche nicht verfügbar',
      error: { code: 'search_unavailable', message: 'Websuche ist in diesem Lauf nicht konfiguriert.' },
    };
  }

  // Per-run cap (spec §4). Honest, actionable message — the model should stop searching.
  if (state.used >= state.max) {
    return {
      ok: false,
      summary: `Such-Limit erreicht (${state.max}/Lauf)`,
      error: {
        code: 'search_run_cap',
        message: `Maximal ${state.max} Websuchen pro Lauf. Arbeite mit den bisherigen Ergebnissen weiter oder frag den Nutzer.`,
      },
    };
  }

  // Per-user daily cap — platform key only; the user's own key is exempt.
  if (!search.capExempt && remainingPlatformSearches(ctx.userId) <= 0) {
    return {
      ok: false,
      summary: 'Tageslimit für Websuchen erreicht',
      error: {
        code: 'search_daily_cap',
        message:
          `Das tägliche Websuch-Kontingent (${searchDailyCap()}) ist aufgebraucht. Mit einem eigenen, ` +
          `kostenlosen Brave-Search-Key (Einstellungen → Konnektoren) suchst du ohne dieses Limit weiter.`,
      },
    };
  }

  state.used += 1;
  if (!search.capExempt) recordPlatformSearch(ctx.userId);

  let results;
  try {
    results = await search.provider.search(query, { count: 5, signal });
  } catch (e) {
    return {
      ok: false,
      summary: `Websuche fehlgeschlagen: ${query}`,
      error: { code: 'search_failed', message: e instanceof Error ? e.message : 'Suche fehlgeschlagen' },
    };
  }

  if (results.length === 0) {
    return { ok: true, summary: `Websuche: „${query}" · keine Treffer`, data: { query, results: [] } };
  }
  return {
    ok: true,
    summary: `Websuche: „${query}" · ${results.length} Treffer`,
    data: { query, results },
  };
}

/**
 * Build the real tool executor. `finish` is intercepted by the orchestrator before it
 * reaches here; if it ever arrives, it's a harmless terminator. `publish` runs the full
 * Live-stellen + truth-gate pipeline (B1) and mutates the run's PublishState so
 * read_deploy_status and the self-heal loop see the outcome. Unknown tools return a
 * structured error.
 */
export function buildToolExecutor(sb: Sb = getSupabaseAdmin(), opts: ExecutorOptions = {}): ToolExecutor {
  const publishDeps = opts.publishDeps ?? realPublishDeps;
  const publishState = opts.publishState ?? newPublishState();
  // F4.3: per-run search budget lives in this closure (one executor per run).
  const searchState = { used: 0, max: opts.maxSearchesPerRun ?? agentMaxSearchesPerRun() };
  return async (call: ToolCall, ctx: ToolContext): Promise<ToolResult> => {
    switch (call.name) {
      case 'web_search':
        return toolWebSearch(ctx, call.args ?? {}, opts.search, searchState);
      case 'list_files':
        return toolListFiles(sb, ctx);
      case 'read_file':
        return toolReadFile(sb, ctx, call.args ?? {});
      case 'write_file':
        return toolWriteFile(sb, ctx, call.args ?? {});
      case 'save_draft':
        return toolSaveDraft(sb, ctx);
      case 'publish': {
        // D-2: per-user publishes/hour cap. An abuser could otherwise drive unlimited
        // Vercel deploys through the agent. Honest German tool error — the run sees it
        // verbatim and stops, exactly like any other publish failure.
        const pubHit = hitRateLimit('publish', `user:${ctx.userId}`, publishesPerHour(), 3_600_000);
        if (!pubHit.allowed) {
          return {
            ok: false,
            summary: `Veröffentlichungs-Limit erreicht (${publishesPerHour()}/Stunde)`,
            error: {
              code: 'publish_rate_limited',
              message: `Zu viele Veröffentlichungen in kurzer Zeit (max ${publishesPerHour()}/Stunde). Bitte in etwa ${Math.ceil(pubHit.retryAfterSec / 60)} Minuten erneut versuchen.`,
            },
          };
        }
        return runPublish(
          publishDeps,
          {
            promoteDrafts: (c) => promoteDrafts(sb, c),
            projectName: (pid) => projectName(sb, pid),
            markDeployed: (pid, url) => markDeployed(sb, pid, url),
            // K3: deterministic safety scan before the deploy (Option A: high-confidence
            // phishing/malware blocks; softer signals are logged).
            scanPublish: (uid, pid) =>
              runPublishGuard({ listFiles: realListFiles, downloadFile: realDownloadFile }, uid, pid),
            sleep: opts.sleep,
          },
          ctx,
          publishState,
          (msg) => ctx.emitProgress?.(msg),
        );
      }
      case 'read_deploy_status':
        return toolReadDeployStatus(sb, ctx, publishState);
      case 'finish':
        return { ok: true, summary: 'fertig', terminate: true, report: String(call.args?.report ?? '') };
      default:
        return {
          ok: false,
          summary: `unbekanntes Werkzeug: ${call.name}`,
          error: { code: 'unknown_tool', message: `Werkzeug ${call.name} existiert nicht` },
        };
    }
  };
}
