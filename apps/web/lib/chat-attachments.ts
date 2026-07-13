/**
 * Chat attachments (Sprint CHAT-IO C2).
 *
 * Turns a picked file into content the model can actually work with, injected as
 * a delimited block in the user's turn (billed like any input — no special path).
 * v1 scope: text-class files + PDF (server-extracted). Images are accepted but get
 * an honest "kann ich noch nicht ansehen" note — no faked vision.
 */
import { API_URL, getAuthHeaders } from '@/lib/api';
import type { Lang } from '@/lib/use-lang';

/** Separate attach budget, per message, across all text/PDF attachments. */
export const ATTACH_BUDGET_CHARS = 24_000;

export type AttachmentKind = 'text' | 'pdf' | 'image' | 'unsupported';
export type AttachmentState = 'ready' | 'extracting' | 'error';

export interface ChatAttachment {
  id: string;
  name: string;
  kind: AttachmentKind;
  state: AttachmentState;
  /** Extracted/read text (text + pdf when ready). */
  content?: string;
  /** Honest, localized error (e.g. scanned PDF, read failure). */
  error?: string;
}

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'html', 'htm', 'xml', 'yml', 'yaml',
  'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'less', 'py', 'rb', 'go', 'rs', 'java',
  'c', 'h', 'cpp', 'hpp', 'cc', 'cs', 'php', 'sh', 'bash', 'sql', 'vue', 'svelte',
  'toml', 'ini', 'env', 'log',
]);

function ext(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function classifyKind(file: File): AttachmentKind {
  if (file.type === 'application/pdf' || ext(file.name) === 'pdf') return 'pdf';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('text/') || TEXT_EXTENSIONS.has(ext(file.name))) return 'text';
  // F-24: an unknown type is NOT an image. The old fallback classified it as
  // 'image', so the model got a "can't view images" note and paraphrased it into
  // a false capability limit ("dazu fehlt mir die Funktion"). Mark it 'unsupported'
  // so it gets an honest, type-specific message instead.
  return 'unsupported';
}

/** Read a text-class file client-side. */
async function readTextFile(file: File): Promise<string> {
  return (await file.text()).replace(/\r\n/g, '\n');
}

/** Ask the server to extract a PDF's text layer. */
async function extractPdf(file: File): Promise<{ text?: string; error?: string }> {
  try {
    const headers = await getAuthHeaders();
    const authHeader = (headers as Record<string, string>)['Authorization'];
    const fd = new FormData();
    fd.append('file', file, file.name);
    const res = await fetch(`${API_URL}/api/attachments/extract`, {
      method: 'POST',
      headers: authHeader ? { Authorization: authHeader } : undefined,
      body: fd,
    });
    const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
    if (!res.ok) return { error: body.error || 'Die PDF konnte nicht gelesen werden.' };
    return { text: body.text };
  } catch {
    return { error: 'Die PDF konnte nicht gelesen werden.' };
  }
}

/**
 * Build a fully-resolved attachment from a picked file: reads text, extracts PDF,
 * or marks an image with an honest note. Never throws.
 */
export async function buildAttachment(file: File, id: string, lang: Lang): Promise<ChatAttachment> {
  const kind = classifyKind(file);
  const base = { id, name: file.name, kind } as const;

  if (kind === 'image') {
    return {
      ...base,
      state: 'ready',
      error:
        lang === 'en'
          ? "I can't view images yet — describe what's in it and I'll help."
          : 'Bilder kann ich noch nicht ansehen — beschreib mir kurz den Inhalt, dann helfe ich dir.',
    };
  }

  if (kind === 'unsupported') {
    // Honest, type-specific — never a false capability claim. Names the concrete
    // type so the user knows exactly what wasn't read.
    const type = ext(file.name);
    return {
      ...base,
      state: 'error',
      error:
        lang === 'en'
          ? `This file couldn't be read (${type ? `.${type} files are` : 'this file type is'} not supported yet).`
          : `Diese Datei konnte nicht gelesen werden (${type ? `Typ .${type}` : 'dieser Dateityp'} wird derzeit nicht unterstützt).`,
    };
  }

  if (kind === 'text') {
    try {
      return { ...base, state: 'ready', content: await readTextFile(file) };
    } catch {
      return { ...base, state: 'error', error: lang === 'en' ? "Couldn't read the file." : 'Datei konnte nicht gelesen werden.' };
    }
  }

  // pdf
  const { text, error } = await extractPdf(file);
  if (error || !text) {
    return { ...base, state: 'error', error: error || (lang === 'en' ? 'No readable text in the PDF.' : 'Kein lesbarer Text in der PDF.') };
  }
  return { ...base, state: 'ready', content: text };
}

/** Total chars that count against the attach budget (text + pdf content). */
export function attachmentCharCount(atts: ChatAttachment[]): number {
  return atts.reduce((n, a) => n + (a.content?.length ?? 0), 0);
}

export interface ComposeResult {
  message: string;
  error?: string;
}

/**
 * Append attachment blocks to the user's message. Text/PDF content rides in a
 * fenced block (labelled with the filename → renders as a file-card and satisfies
 * E7 as user-provided content). Images append an honest no-vision note. Over
 * budget → an error is returned and the caller must block the send (never a
 * silent truncation).
 */
export function composeMessageWithAttachments(
  text: string,
  atts: ChatAttachment[],
  lang: Lang,
): ComposeResult {
  // Include every RESOLVED attachment (ready + errored) — only in-flight
  // 'extracting' is excluded. F-24: a failed/unsupported read must inject an
  // honest note, never be silently dropped (which let the model confabulate).
  const usable = atts.filter((a) => a.state !== 'extracting');
  if (usable.length === 0) return { message: text };

  const chars = attachmentCharCount(usable);
  if (chars > ATTACH_BUDGET_CHARS) {
    return {
      message: text,
      error:
        lang === 'en'
          ? `Attachments are too large (${chars.toLocaleString()} / ${ATTACH_BUDGET_CHARS.toLocaleString()} characters). Remove one or shorten it.`
          : `Die Anhänge sind zu groß (${chars.toLocaleString()} / ${ATTACH_BUDGET_CHARS.toLocaleString()} Zeichen). Entferne einen oder kürze ihn.`,
    };
  }

  const blocks: string[] = [];
  for (const a of usable) {
    if (a.content) {
      // Successfully read text/PDF → the real content as a file-card block.
      const label = lang === 'en' ? 'Attached file' : 'Angehängte Datei';
      blocks.push(`${label}: ${a.name}\n\`\`\`${a.name}\n${a.content}\n\`\`\``);
    } else if (a.kind === 'image') {
      const label = lang === 'en' ? 'Attached image' : 'Angehängtes Bild';
      blocks.push(`[${label}: ${a.name} — ${a.error ?? (lang === 'en' ? "can't be viewed." : 'kann nicht angesehen werden.')}]`);
    } else if (a.error) {
      // Unsupported type or a failed read → inject the HONEST, type-specific
      // reason so the model states it accurately instead of inventing a limit.
      const label = lang === 'en' ? 'Attached file' : 'Angehängte Datei';
      blocks.push(`[${label}: ${a.name} — ${a.error}]`);
    }
  }

  const joined = blocks.join('\n\n');
  const message = text.trim() ? `${text.trim()}\n\n${joined}` : joined;
  return { message };
}
