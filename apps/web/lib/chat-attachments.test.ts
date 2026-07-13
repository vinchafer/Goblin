// U5 (F-24) GATE — attachment honesty.
//
// The agent said "Ich kann die Datei im Anhang nicht sehen — dazu fehlt mir die
// Funktion" shortly after reading a PDF. Root cause: unknown types were classified
// as 'image' and got a vision-limit note the model paraphrased into a false
// capability claim; failed reads were silently dropped. These probes lock the fix:
// unsupported types get an HONEST, type-specific message, and every resolved
// attachment injects a truthful note (never a fake image limit, never a silent drop).

import { describe, it, expect, vi } from 'vitest';

// buildAttachment's PDF branch imports the API client; the text/image/unsupported
// branches under test never touch the network. Mock it so the import is inert.
vi.mock('@/lib/api', () => ({ API_URL: 'http://localhost', getAuthHeaders: async () => ({}) }));

import { classifyKind, buildAttachment, composeMessageWithAttachments, ATTACHMENT_ACCEPT, type ChatAttachment } from './chat-attachments';

const file = (name: string, type: string, body = 'x') => new File([body], name, { type });

describe('classifyKind', () => {
  it('recognizes pdf, image and text', () => {
    expect(classifyKind(file('a.pdf', 'application/pdf'))).toBe('pdf');
    expect(classifyKind(file('a.png', 'image/png'))).toBe('image');
    expect(classifyKind(file('a.txt', 'text/plain'))).toBe('text');
    expect(classifyKind(file('a.ts', ''))).toBe('text'); // by extension
  });

  it('an unknown binary type is UNSUPPORTED, not image (F-24 root cause)', () => {
    expect(classifyKind(file('a.bin', 'application/octet-stream'))).toBe('unsupported');
    expect(classifyKind(file('weird', 'application/x-thing'))).toBe('unsupported');
  });

  // F-42: the founder could not attach .md. These types must classify as text —
  // crucially even when the OS reports NO MIME (the real-world .md/.csv case).
  it('recognizes .md/.markdown/.csv/.json/.txt as text even with an empty MIME', () => {
    for (const name of ['README.md', 'notes.markdown', 'data.csv', 'config.json', 'plain.txt']) {
      expect(classifyKind(file(name, ''))).toBe('text');
    }
  });

  it('recognizes .md via its reported text/markdown MIME too', () => {
    expect(classifyKind(file('README.md', 'text/markdown'))).toBe('text');
  });
});

describe('ATTACHMENT_ACCEPT (F-42 picker whitelist)', () => {
  it('lists the new text/code extensions explicitly so a MIME-less .md is pickable', () => {
    for (const ext of ['.md', '.markdown', '.txt', '.csv', '.json']) {
      expect(ATTACHMENT_ACCEPT).toContain(ext);
    }
  });

  it('still accepts images and PDF (regression)', () => {
    expect(ATTACHMENT_ACCEPT).toContain('image/*');
    expect(ATTACHMENT_ACCEPT).toContain('application/pdf');
  });
});

describe('buildAttachment', () => {
  it('reads a .txt file as real content (regression: text stays supported)', async () => {
    const a = await buildAttachment(file('notes.txt', 'text/plain', 'hallo\r\nwelt'), '1', 'de');
    expect(a.kind).toBe('text');
    expect(a.state).toBe('ready');
    expect(a.content).toBe('hallo\nwelt');
  });

  it('parses a .md file into real context (F-42 — was unsupported before)', async () => {
    const a = await buildAttachment(file('README.md', '', '# Titel\n\nInhalt'), 'md1', 'de');
    expect(a.kind).toBe('text');
    expect(a.state).toBe('ready');
    expect(a.content).toBe('# Titel\n\nInhalt');
  });

  it('an unsupported type yields an HONEST, type-specific message — never a capability claim', async () => {
    const de = await buildAttachment(file('archive.zip', 'application/zip'), '2', 'de');
    expect(de.kind).toBe('unsupported');
    expect(de.state).toBe('error');
    expect(de.error).toMatch(/Typ \.zip wird derzeit nicht unterstützt/);
    // It must NOT claim a missing capability / pretend it's an image.
    expect(de.error).not.toMatch(/Funktion|ansehen|Bild/);

    const en = await buildAttachment(file('archive.zip', 'application/zip'), '3', 'en');
    expect(en.error).toMatch(/\.zip files are not supported yet/);
  });

  it('an image still gets its honest no-vision note (unchanged)', async () => {
    const a = await buildAttachment(file('p.png', 'image/png'), '4', 'de');
    expect(a.kind).toBe('image');
    expect(a.state).toBe('ready');
    expect(a.error).toMatch(/Bilder kann ich noch nicht ansehen/);
  });
});

describe('composeMessageWithAttachments', () => {
  const txt: ChatAttachment = { id: '1', name: 'a.txt', kind: 'text', state: 'ready', content: 'HELLO' };
  const unsup: ChatAttachment = { id: '2', name: 'a.zip', kind: 'unsupported', state: 'error', error: 'Diese Datei konnte nicht gelesen werden (Typ .zip wird derzeit nicht unterstützt).' };

  it('injects real content for a read file', () => {
    const { message } = composeMessageWithAttachments('bitte lies', [txt], 'de');
    expect(message).toContain('Angehängte Datei: a.txt');
    expect(message).toContain('HELLO');
  });

  it('injects the honest note for an unsupported file — not dropped, not framed as an image', () => {
    const { message } = composeMessageWithAttachments('was ist das?', [unsup], 'de');
    expect(message).toContain('wird derzeit nicht unterstützt');
    expect(message).toContain('a.zip');
    // The F-24 failure: an unsupported file must NOT be presented as an image.
    expect(message).not.toContain('Angehängtes Bild');
  });

  it('does not silently drop a failed read (an errored attachment still speaks)', () => {
    const failedPdf: ChatAttachment = { id: '9', name: 'scan.pdf', kind: 'pdf', state: 'error', error: 'Kein lesbarer Text in der PDF.' };
    const { message } = composeMessageWithAttachments('', [failedPdf], 'de');
    expect(message).toContain('Kein lesbarer Text in der PDF.');
    expect(message).toContain('scan.pdf');
  });
});
