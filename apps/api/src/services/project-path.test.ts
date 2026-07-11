// WAVE-D · D-1 gate — adversarial coverage of the project-path safety boundary.
// Every attack vector the audit named (traversal, absolute, encoded separators, null
// bytes, backslash, drive letters, home expansion, cross-project escape) is denied;
// every legitimate project-relative path (subdirs, honest dotdirs, assets) is allowed.

import { describe, it, expect } from 'vitest';
import {
  checkProjectPath,
  isForbiddenWriteTarget,
  assertSafeStoragePath,
  WRITE_FILE_MAX_CHARS,
} from './project-path';

describe('checkProjectPath — legitimate paths pass and canonicalize', () => {
  it.each([
    ['index.html', 'index.html'],
    ['css/app.css', 'css/app.css'],
    ['assets/img/logo.png', 'assets/img/logo.png'],
    ['./index.html', 'index.html'],
    ['css//app.css', 'css/app.css'],
    ['a/./b/c.js', 'a/b/c.js'],
    ['.trash/old.html', '.trash/old.html'],
    ['folder/.gitkeep', 'folder/.gitkeep'],
    ['  spaced.html  ', 'spaced.html'],
    ['robots.txt', 'robots.txt'],
    ['deep/nested/very/deep/file.json', 'deep/nested/very/deep/file.json'],
  ])('allows %j → %j', (input, expected) => {
    const res = checkProjectPath(input);
    expect(res.ok).toBe(true);
    expect(res.path).toBe(expected);
  });
});

describe('checkProjectPath — path traversal is denied', () => {
  it.each([
    ['../secret.html', 'traversal'],
    ['../../etc/passwd', 'traversal'],
    ['css/../../other-project/index.html', 'traversal'],
    ['a/b/../../../../escape', 'traversal'],
    ['foo/..', 'traversal'],
    ['..', 'traversal'],
    ['./../x', 'traversal'],
  ])('denies %j (reason=%s)', (input, reason) => {
    const res = checkProjectPath(input);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe(reason);
    expect(res.path).toBeUndefined();
  });
});

describe('checkProjectPath — absolute / drive / home paths are denied', () => {
  it.each([
    ['/etc/passwd', 'absolute'],
    ['/index.html', 'absolute'],
    ['C:/Windows/system32', 'drive_letter'],
    ['c:\\temp\\x', 'backslash'], // backslash check fires first — still denied
    ['~/secrets', 'home_expansion'],
    ['~root/.ssh/id_rsa', 'home_expansion'],
  ])('denies %j (reason=%s)', (input, reason) => {
    const res = checkProjectPath(input);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe(reason);
  });
});

describe('checkProjectPath — encoded separators & backslashes are denied', () => {
  it.each([
    ['..%2f..%2fetc%2fpasswd', 'encoded_separator'],
    ['%2e%2e/secret', 'encoded_separator'],
    ['css%2fapp.css', 'encoded_separator'],
    ['a%5cb', 'encoded_separator'],
    ['..\\..\\windows', 'backslash'],
    ['css\\app.css', 'backslash'],
  ])('denies %j (reason=%s)', (input, reason) => {
    const res = checkProjectPath(input);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe(reason);
  });
});

describe('checkProjectPath — null bytes / control chars are denied', () => {
  it('denies an embedded NUL byte (truncation attack)', () => {
    const res = checkProjectPath('index.html\x00.png');
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('null_byte');
  });
  it('denies a newline in the path', () => {
    const res = checkProjectPath('a\nb.html');
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('null_byte');
  });
});

describe('checkProjectPath — empty / non-string inputs are denied', () => {
  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['.', 'empty'],
    ['./', 'empty'],
    ['/', 'absolute'],
  ])('denies %j (reason=%s)', (input, reason) => {
    const res = checkProjectPath(input);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe(reason);
  });
  it.each([[null], [undefined], [42], [{}], [['a']]])('denies non-string %j', (input) => {
    const res = checkProjectPath(input as unknown);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('not_string');
  });
});

describe('isForbiddenWriteTarget — secret & control files', () => {
  it.each([
    '.env',
    '.env.local',
    '.env.production',
    '.npmrc',
    '.netrc',
    '.git-credentials',
    '.htpasswd',
    '.git/config',
    'nested/.git/HEAD',
    '.ssh/id_rsa',
    'sub/.aws/credentials',
  ])('forbids %j', (path) => {
    expect(isForbiddenWriteTarget(path)).toBe(true);
  });
  it.each([
    'index.html',
    'env.js',
    'environment.css',
    'assets/.gitkeep',
    '.trash/old.html',
    'config.json',
    'my.env.example.txt',
  ])('allows %j', (path) => {
    expect(isForbiddenWriteTarget(path)).toBe(false);
  });
});

describe('assertSafeStoragePath — throws tagged error on unsafe input', () => {
  it('returns the canonical path when safe', () => {
    expect(assertSafeStoragePath('./css//app.css')).toBe('css/app.css');
  });
  it.each(['../escape', '/abs', '..\\win', 'a%2fb', 'x\x00y'])(
    'throws unsafe_path for %j',
    (input) => {
      let thrown: (Error & { code?: string }) | null = null;
      try {
        assertSafeStoragePath(input);
      } catch (e) {
        thrown = e as Error & { code?: string };
      }
      expect(thrown).not.toBeNull();
      expect(thrown!.code).toBe('unsafe_path');
    },
  );
});

describe('constants', () => {
  it('write cap is 500k', () => {
    expect(WRITE_FILE_MAX_CHARS).toBe(500_000);
  });
});
