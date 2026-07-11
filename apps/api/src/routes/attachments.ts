/**
 * Chat attachment helpers (Sprint CHAT-IO C2).
 *
 * PDF text extraction so an attached PDF can actually reach the model. Text-class
 * files (txt/md/code/csv/json/html) are read client-side; only PDFs need this
 * server round-trip (a light, maintained extractor — no native deps). Scanned /
 * image-only PDFs carry no text layer → honest "kein lesbarer Text" response.
 *
 * The extracted text is returned to the client, which injects it into the user's
 * turn as a delimited block — so it is billed to the user allowance like any input
 * (no special server path). See ledger M9.
 */
import { Hono } from 'hono';
import { extractText, getDocumentProxy } from 'unpdf';
import { authMiddleware } from '../middleware/auth';
import logger from '../lib/logger';
import { consumeDailyBytes, attachmentBytesPerDay } from '../services/abuse-caps';

// Upload ceiling for a single PDF. The 24k-char attach budget is enforced
// client-side after extraction; this only bounds the raw upload.
export const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

export const attachments = new Hono<{ Variables: { userId: string } }>();
attachments.use('*', authMiddleware);

attachments.post('/extract', async (c) => {
  let body: Record<string, string | File>;
  try {
    body = await c.req.parseBody();
  } catch {
    return c.json({ error: 'Die Datei konnte nicht gelesen werden.' }, 400);
  }

  const file = body['file'];
  if (!(file instanceof File)) {
    return c.json({ error: 'Keine Datei empfangen.' }, 400);
  }
  if (file.size === 0) {
    return c.json({ error: 'Die Datei ist leer.' }, 400);
  }
  if (file.size > MAX_PDF_BYTES) {
    return c.json({ error: 'Die PDF ist zu groß. Bitte teile sie auf oder kopiere den relevanten Text direkt hinein.' }, 413);
  }

  // D-2: per-user attachment bytes/day cap. Bounds an upload flood (many under-10MB
  // files) that the per-file ceiling alone can't. Denied requests do not consume budget.
  const userId = c.get('userId');
  const bytesCap = consumeDailyBytes('attachment', userId, file.size, attachmentBytesPerDay());
  if (!bytesCap.allowed) {
    c.header('Retry-After', '3600');
    return c.json(
      {
        error: 'attachment_daily_cap',
        message: 'Du hast heute schon viele Dateien hochgeladen. Bitte morgen wieder — oder kopiere den relevanten Text direkt in die Nachricht.',
      },
      429,
    );
  }

  let text: string;
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buf);
    const res = await extractText(pdf, { mergePages: true });
    text = (Array.isArray(res.text) ? res.text.join('\n') : res.text ?? '').trim();
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'pdf_extract_failed');
    return c.json({ error: 'Die PDF konnte nicht gelesen werden. Bitte kopiere den relevanten Text direkt in die Nachricht.' }, 422);
  }

  if (!text) {
    // Scanned / image-only PDF: no text layer.
    return c.json({ error: 'Diese PDF enthält keinen lesbaren Text (vermutlich ein Scan). Beschreib mir den Inhalt oder füge den Text direkt ein.' }, 422);
  }

  return c.json({ text });
});
