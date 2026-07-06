// FEEL-3a — the five tools (A3). Thin adapters over the ALREADY-HARDENED services,
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
import { isSoftDeletedPath, FILE_CONTENT_BUDGET_CHARS } from '../project-context';
import { classifyFile, lineDelta, checkStcIntegrity } from '@goblin/shared';
import logger from '../../lib/logger';
import type { ToolSpec, ToolExecutor, ToolCall, ToolResult, ToolContext } from './types';

// ─── Tool schemas (native function-calling shape + the fallback JSON contract) ──

export const AGENT_TOOLS: ToolSpec[] = [
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
      'Veröffentlicht NICHT; das übernimmt der Nutzer mit „Live stellen" im Code-Bereich.',
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
  const path = typeof args.path === 'string' ? args.path.trim() : '';
  if (!path) return { ok: false, summary: 'Pfad fehlt', error: { code: 'bad_args', message: 'path erforderlich' } };
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
  const path = typeof args.path === 'string' ? args.path.trim() : '';
  const content = typeof args.content === 'string' ? args.content : '';
  if (!path) return { ok: false, summary: 'Pfad fehlt', error: { code: 'bad_args', message: 'path erforderlich' } };
  if (content.length > 500_000) {
    return { ok: false, summary: `${path} · zu gross`, error: { code: 'too_large', message: 'Inhalt über 500k Zeichen' } };
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

async function toolSaveDraft(sb: Sb, ctx: ToolContext): Promise<ToolResult> {
  const { data: drafts } = await sb
    .from('code_session_files')
    .select('id, path, content')
    .eq('session_id', ctx.sessionId)
    .eq('change_state', 'draft');

  if (!drafts || drafts.length === 0) {
    // Idempotent: nothing to save is a success, not an error.
    return { ok: true, summary: 'Keine Entwürfe zu sichern', data: { saved: 0 } };
  }

  // Storage cap — pre-check the whole batch before any write (mirrors POST /save).
  let aggregateDelta = 0;
  for (const f of drafts) {
    aggregateDelta += byteLen(f.content as string) - (await headBytes(ctx.projectId, f.path as string));
  }
  try {
    await assertStorageRoom(ctx.userId, aggregateDelta);
  } catch (e) {
    return { ok: false, summary: 'Speicher voll', error: { code: 'storage_full', message: (e as Error).message } };
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
  return {
    ok: saved.length > 0,
    summary: saved.length ? `${saved.length} Datei${saved.length === 1 ? '' : 'en'} gesichert ✓` : 'Sichern fehlgeschlagen',
    data: { saved: saved.length, paths: saved },
  };
}

/**
 * Build the real tool executor. `finish` is intercepted by the orchestrator before it
 * reaches here; if it ever arrives, it's a harmless terminator. Unknown tools return a
 * structured error (the model self-heals in 3b; here it informs the narration).
 */
export function buildToolExecutor(sb: Sb = getSupabaseAdmin()): ToolExecutor {
  return async (call: ToolCall, ctx: ToolContext): Promise<ToolResult> => {
    switch (call.name) {
      case 'list_files':
        return toolListFiles(sb, ctx);
      case 'read_file':
        return toolReadFile(sb, ctx, call.args ?? {});
      case 'write_file':
        return toolWriteFile(sb, ctx, call.args ?? {});
      case 'save_draft':
        return toolSaveDraft(sb, ctx);
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
