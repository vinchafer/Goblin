// FW5-U3 — upload type whitelist (the guard the explorer route was missing).
import { describe, it, expect } from 'vitest';
import { checkUploadType, fileExtension, ALLOWED_UPLOAD_EXTENSIONS, MAX_UPLOAD_BYTES } from './upload-policy';

describe('upload-policy — checkUploadType', () => {
  it('accepts text/code, images, pdf and documents', () => {
    for (const name of ['app.tsx', 'README.md', 'data.json', 'logo.svg', 'photo.png', 'brief.pdf', 'antrag.docx', 'tabelle.xlsx']) {
      expect(checkUploadType(name).ok, name).toBe(true);
    }
  });

  it('is case-insensitive on the extension', () => {
    expect(checkUploadType('IMAGE.PNG').ok).toBe(true);
    expect(checkUploadType('Report.PDF').ok).toBe(true);
  });

  it('rejects unknown / dangerous types honestly with the extension', () => {
    const exe = checkUploadType('malware.exe');
    expect(exe.ok).toBe(false);
    expect(exe.reason).toBe('type_not_allowed');
    expect(exe.ext).toBe('exe');
    for (const name of ['a.sh.bin', 'x.zip', 'y.bat', 'z.dll']) {
      // .sh IS allowed (code), so a.sh.bin ends in .bin → rejected.
      expect(checkUploadType(name).ok, name).toBe(false);
    }
  });

  it('rejects an extensionless file (cannot classify)', () => {
    const r = checkUploadType('Dockerfile');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_extension');
  });

  it('fileExtension handles dotfiles and no-extension', () => {
    expect(fileExtension('.env')).toBe('');      // leading dot only → no ext
    expect(fileExtension('a.b.c')).toBe('c');
    expect(fileExtension('plain')).toBe('');
  });

  it('exposes a sane ceiling + a non-empty allowlist', () => {
    expect(MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
    expect(ALLOWED_UPLOAD_EXTENSIONS.has('pdf')).toBe(true);
    expect(ALLOWED_UPLOAD_EXTENSIONS.has('exe')).toBe(false);
  });
});
