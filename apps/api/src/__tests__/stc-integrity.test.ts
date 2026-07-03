// P0.3 (feel-sprint-1): Send-to-Code filename integrity.
import { describe, it, expect } from 'vitest';
import { checkStcIntegrity, applyRenames } from '@goblin/shared/src/stc-integrity';

const HTML_W10 = `<!doctype html><html><head>
  <link rel="stylesheet" href="styles.css">
  <script src="settings.js"></script>
</head><body>Einstellungen</body></html>`;

describe('checkStcIntegrity', () => {
  it('W10 case: referenced styles.css/settings.js vs payload script.js/script-1.js', () => {
    const r = checkStcIntegrity([
      { path: 'index.html', content: HTML_W10 },
      { path: 'script.js', content: 'a' },
      { path: 'script-1.js', content: 'b' },
    ]);
    expect(r.ok).toBe(false);
    expect(r.missing.sort()).toEqual(['settings.js', 'styles.css']);
    expect(r.orphans.sort()).toEqual(['script-1.js', 'script.js']);
    // Two js orphans for one js reference → ambiguous → no js auto-rename;
    // no css orphan → no css rename either.
    expect(r.renameMap).toEqual({});
  });

  it('proposes the unambiguous 1:1 rename', () => {
    const r = checkStcIntegrity([
      { path: 'index.html', content: '<script src="app.js"></script>' },
      { path: 'script.js', content: 'x' },
    ]);
    expect(r.ok).toBe(false);
    expect(r.renameMap).toEqual({ 'script.js': 'app.js' });
  });

  it('passes when every reference is present', () => {
    const r = checkStcIntegrity([
      { path: 'index.html', content: '<link href="styles.css" rel="stylesheet"><script src="app.js"></script>' },
      { path: 'styles.css', content: 'x' },
      { path: 'app.js', content: 'y' },
    ]);
    expect(r.ok).toBe(true);
    expect(r.orphans).toEqual([]);
  });

  it('no HTML entry → nothing to check', () => {
    const r = checkStcIntegrity([{ path: 'main.py', content: 'print(1)' }]);
    expect(r.ok).toBe(true);
    expect(r.entryPath).toBeNull();
  });

  it('external/data refs never count as missing', () => {
    const r = checkStcIntegrity([
      { path: 'index.html', content: '<script src="https://cdn.x/y.js"></script><img src="data:image/png;base64,A">' },
    ]);
    expect(r.ok).toBe(true);
  });
});

describe('applyRenames', () => {
  it('renames paths, leaves content', () => {
    const out = applyRenames(
      [{ path: 'script.js', content: 'x' }, { path: 'index.html', content: 'h' }],
      { 'script.js': 'app.js' },
    );
    expect(out.map((f) => f.path)).toEqual(['app.js', 'index.html']);
    expect(out[0]!.content).toBe('x');
  });
});
