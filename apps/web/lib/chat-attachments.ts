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

export type AttachmentKind = 'text' | 'pdf' | 'image';
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
  // Unknown non-text binary → treat as image-class (honest "can't read") so we
  // never silently pretend to have read bytes we can't parse.
  return 'image';
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
  const usable = atts.filter((a) => a.state === 'ready' || a.kind === 'image');
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
    if (a.kind === 'image') {
      const label = lang === 'en' ? 'Attached image' : 'Angehängtes Bild';
      blocks.push(`[${label}: ${a.name} — ${a.error ?? (lang === 'en' ? "can't be viewed." : 'kann nicht angesehen werden.')}]`);
    } else if (a.content) {
      const label = lang === 'en' ? 'Attached file' : 'Angehängte Datei';
      blocks.push(`${label}: ${a.name}\n\`\`\`${a.name}\n${a.content}\n\`\`\``);
    }
  }

  const joined = blocks.join('\n\n');
  const message = text.trim() ? `${text.trim()}\n\n${joined}` : joined;
  return { message };
}
