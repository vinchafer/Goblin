/**
 * Chat attachment PDF-extract endpoint (C2) — auth, guards, and the extract
 * happy / no-text paths (unpdf mocked for determinism). No real PDF, no network.
 */
import { describe, it, expect, vi } from 'vitest';

const fakeSupabase = {
  auth: {
    getUser: (token: string) => {
      const id = token?.startsWith('user:') ? token.slice(5) : null;
      return Promise.resolve(
        id ? { data: { user: { id } }, error: null } : { data: { user: null }, error: { message: 'bad' } },
      );
    },
  },
};

const extractMock = vi.fn();
vi.mock('unpdf', () => ({
  getDocumentProxy: vi.fn(async () => ({})),
  extractText: (...args: unknown[]) => extractMock(...args),
}));
vi.mock('../lib/supabase', () => ({ getSupabaseAdmin: () => fakeSupabase }));
vi.mock('../lib/logger', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { attachments, MAX_PDF_BYTES } = await import('./attachments');

const auth = (user: string) => ({ Authorization: `Bearer user:${user}` });

function pdfForm(bytes: number): FormData {
  const fd = new FormData();
  fd.append('file', new File([new Uint8Array(bytes).fill(1)], 'doc.pdf', { type: 'application/pdf' }));
  return fd;
}

describe('POST /api/attachments/extract', () => {
  it('rejects unauthenticated → 401', async () => {
    const res = await attachments.request('/extract', { method: 'POST', body: pdfForm(1024) });
    expect(res.status).toBe(401);
  });

  it('rejects a missing file → 400', async () => {
    const res = await attachments.request('/extract', { method: 'POST', headers: auth('alice'), body: new FormData() });
    expect(res.status).toBe(400);
  });

  it('rejects an oversized PDF → 413', async () => {
    const res = await attachments.request('/extract', { method: 'POST', headers: auth('alice'), body: pdfForm(MAX_PDF_BYTES + 1) });
    expect(res.status).toBe(413);
  });

  it('extracts text from a PDF with a text layer → 200', async () => {
    extractMock.mockResolvedValueOnce({ text: 'Hallo Goblin\nSeite 2' });
    const res = await attachments.request('/extract', { method: 'POST', headers: auth('alice'), body: pdfForm(2048) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { text: string };
    expect(body.text).toContain('Hallo Goblin');
  });

  it('reports honestly when a PDF has no readable text (scan) → 422', async () => {
    extractMock.mockResolvedValueOnce({ text: '   ' });
    const res = await attachments.request('/extract', { method: 'POST', headers: auth('alice'), body: pdfForm(2048) });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/kein.*lesbar|Scan/i);
  });
});
