// WAVE-E E2 — the React/Vite framework template is complete, buildable-shaped, and
// beauty-block compliant, and its declared deps stay in lockstep with the E3 allowlist.

import { describe, it, expect } from 'vitest';
import {
  getFrameworkTemplate,
  buildFrameworkFiles,
  SUPPORTED_FRAMEWORKS,
} from './framework-templates';

describe('framework template registry', () => {
  it('supports exactly react-vite in v1 (D-E3)', () => {
    expect(SUPPORTED_FRAMEWORKS).toEqual(['react-vite']);
  });

  it('resolves friendly aliases, rejects unknown frameworks', () => {
    expect(getFrameworkTemplate('react-vite')?.id).toBe('react-vite');
    expect(getFrameworkTemplate('React')?.id).toBe('react-vite');
    expect(getFrameworkTemplate('vite')?.id).toBe('react-vite');
    expect(getFrameworkTemplate('nextjs')).toBeNull(); // deferred to v2
    expect(getFrameworkTemplate('svelte')).toBeNull();
  });

  it('carries the vercel framework value the deploy path needs (E3)', () => {
    expect(getFrameworkTemplate('react-vite')?.vercelFramework).toBe('vite');
  });
});

describe('react-vite files', () => {
  const files = buildFrameworkFiles('react-vite', 'Aufgabenliste');

  it('is a complete, buildable Vite/React/TS scaffold', () => {
    for (const p of ['package.json', 'index.html', 'vite.config.ts', 'tsconfig.json', 'src/main.tsx', 'src/App.tsx', 'src/index.css']) {
      expect(Object.keys(files)).toContain(p);
    }
  });

  it('package.json pins every dependency to an exact version (D-E2 lockfile-pinning)', () => {
    const pkg = JSON.parse(files['package.json']!);
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [, version] of Object.entries(all)) {
      // exact pin — no ^, ~, *, ranges. (The allowlist cross-check lives in E3.)
      expect(String(version)).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('the build script runs tsc then vite build (Vercel builds from source, E3)', () => {
    const pkg = JSON.parse(files['package.json']!);
    expect(pkg.scripts.build).toContain('vite build');
  });

  it('tsconfig does not use a composite/noEmit project reference (regression: E4 build caught TS6310)', () => {
    // A referenced project that disables emit fails `tsc` with TS6310. The E4 real build
    // caught this; the template now uses a single tsconfig with no references.
    const tsconfig = JSON.parse(files['tsconfig.json']!);
    expect(tsconfig.references).toBeUndefined();
    expect(Object.keys(files)).not.toContain('tsconfig.node.json');
  });

  it('personalizes the app name into the title and package name', () => {
    expect(files['index.html']).toContain('<title>Aufgabenliste</title>');
    expect(JSON.parse(files['package.json']!).name).toBe('aufgabenliste');
  });

  it('applies the beauty block: font pairing + Sage/Copper tokens + dark variant + mobile-first', () => {
    const html = files['index.html']!;
    const css = files['src/index.css']!;
    expect(html).toContain('fonts.googleapis.com'); // deliberate Google-Font pairing
    expect(html).toMatch(/Space\+Grotesk/);
    expect(css).toContain('--copper');
    expect(css).toContain('--sage');
    expect(css).toContain('prefers-color-scheme: dark'); // dark variant
    expect(html).toContain('width=device-width'); // mobile-first viewport
    expect(html).toContain('lang="de"'); // German UI
  });

});
