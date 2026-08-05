/**
 * FINAL-POLISH · U4 — one loading screen, proven.
 *
 * The founder, on prod: several different loading screens, sometimes a small gold mark,
 * sometimes the large green one, and a jump from gold to green mid-load. Six independently
 * written loading states caused it. This pins the unification so it cannot drift back:
 * every full-page loading surface renders the SAME component, and none of them renders a
 * gold mark.
 *
 * Source assertions, in the style of redemption-contract.test.ts — "no loading surface
 * uses gold any more" is a statement about absence, and reading the checkout is how you
 * show an absence.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const WEB = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

/** Every surface that shows a full-page/full-pane "we are loading" state. */
const LOADING_SURFACES = [
  'app/loading.tsx',
  'app/dashboard/projects/page.tsx',
  'app/dashboard/chats/page.tsx',
  'app/dashboard/chat/page.tsx',
  'components/code/CodeWorkspace.tsx',
  'components/workspace/chat-tab.tsx',
];

const pageLoadingSrc = read('components/ui/PageLoading.tsx');

describe('U4 — every loading surface renders the one component', () => {
  it.each(LOADING_SURFACES)('%s uses PageLoading', (file) => {
    const src = read(file);
    expect(src).toMatch(/<PageLoading/);
    expect(src).toMatch(/from ['"]@\/components\/ui\/PageLoading['"]/);
  });

  it('none of them hand-rolls its own mark any more', () => {
    for (const file of LOADING_SURFACES) {
      const src = read(file);
      // The mark may only appear via PageLoading — not inline in the surface.
      expect(src, `${file} still renders GoblinLogo directly`).not.toMatch(/<GoblinLogo/);
    }
  });
});

describe('U4 — the gold mark is gone from loading surfaces (the jump)', () => {
  it('no loading surface renders a gold mark', () => {
    for (const file of LOADING_SURFACES) {
      expect(read(file), `${file} still renders a gold mark`).not.toMatch(/variant=["']gold["']/);
    }
    expect(pageLoadingSrc).not.toMatch(/variant=["']gold["']/);
  });

  it('the old GoblinLoader — whose default variant was gold — is deleted, not merely unused', () => {
    expect(existsSync(join(WEB, 'components/ui/GoblinLoader.tsx'))).toBe(false);
  });

  it('nothing imports it any more', () => {
    for (const file of [...LOADING_SURFACES, 'components/ui/PageLoading.tsx']) {
      expect(read(file)).not.toMatch(/from ['"]@\/components\/ui\/GoblinLoader['"]/);
    }
  });
});

describe('U4 — one mark, one size, one colour', () => {
  it('is the large breathing brand mark the founder picked', () => {
    expect(pageLoadingSrc).toMatch(/PAGE_LOADING_MARK_SIZE = 64/);
    expect(pageLoadingSrc).toMatch(/<GoblinLogo\s+state="breath"\s+size=\{PAGE_LOADING_MARK_SIZE\}\s+variant="brand"/);
  });

  it('uses the THEME-AWARE brand token, not the locked anchor', () => {
    // Rendering the screen in dark mode is what caught this: `green` resolves to
    // --brand-green, which never flips, so the mark sat dark-green on the dark-green
    // page surface — all but invisible. `brand` resolves to --brand-fg (sage in dark).
    // Regression guard: a loading screen must never use the locked fill anchor.
    expect(pageLoadingSrc).not.toMatch(/variant=["']green["']/);
    const logoSrc = read('components/brand/GoblinLogo.tsx');
    expect(logoSrc).toMatch(/brand:\s*"var\(--brand-fg\)"/);
    expect(logoSrc).toMatch(/green:\s*"var\(--brand-green\)"/); // the anchor still exists for fills
  });

  it('renders the mark exactly once — no second, differently-sized copy', () => {
    expect(pageLoadingSrc.match(/<GoblinLogo/g) ?? []).toHaveLength(1);
  });
});

describe('U4 — the context line is honest and bilingual', () => {
  // Each surface says what IS loading. "Workspace wird geladen" on the chats list was
  // the kind of near-miss that reads as sloppy.
  const contexts = ['workspace', 'projects', 'chats', 'chat', 'code', 'files'];

  it.each(contexts)('%s has both a DE and an EN line', (key) => {
    const row = pageLoadingSrc.match(new RegExp(`${key}:\\s*\\{[^}]*\\}`));
    expect(row, `no copy row for ${key}`).not.toBeNull();
    expect(row![0]).toMatch(/de:\s*'[^']+'/);
    expect(row![0]).toMatch(/en:\s*'[^']+'/);
  });

  it('the DE and EN lines actually differ (no untranslated leak)', () => {
    for (const key of contexts) {
      const row = pageLoadingSrc.match(new RegExp(`${key}:\\s*\\{[^}]*\\}`))![0];
      const de = row.match(/de:\s*'([^']+)'/)![1];
      const en = row.match(/en:\s*'([^']+)'/)![1];
      expect(de, `${key}: DE and EN are identical`).not.toBe(en);
    }
  });

  it('supports rendering with no caption at all', () => {
    // Places where a line would be noise pass nothing; the mark still renders.
    expect(pageLoadingSrc).toMatch(/context = 'none'/);
    expect(pageLoadingSrc).toMatch(/context === 'none' \? null/);
  });

  it('resolves the language through the app-wide source of truth', () => {
    expect(pageLoadingSrc).toMatch(/from '@\/lib\/use-lang'/);
    expect(pageLoadingSrc).not.toMatch(/navigator\.language/);
  });
});
