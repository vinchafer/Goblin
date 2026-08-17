/**
 * PREVIEW-REMOVED — the founder decision, pinned.
 *
 * The tester found the Preview button unclickable, with nothing on screen saying why.
 * The founder's call was to REMOVE the feature rather than repair it: a control that is
 * visible and dead is the worst honesty class this product has, and it is not replaced
 * by a "coming soon" either — a promise nobody committed to is the same phantom wearing
 * a politer label.
 *
 * These assertions are on the SOURCE, not on a rendered tree, for the same reason the
 * hosted-publish sheet pins its wording that way: what must not come back is the
 * *affordance*, and the cheapest way for it to come back is somebody re-adding an entry
 * to a tab array during an unrelated change.
 *
 * The demo/pitch route (`/demo-preview` → components/demo/DemoPreviewChrome) is
 * deliberately out of scope here: it is not a product surface, no app route reaches it,
 * and it is on the founder-action list as a pitch decision.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(__dirname, '..', '..', rel), 'utf8');

/**
 * Source with comments stripped. Every assertion here is about what the app DOES, and
 * the comments explaining why preview was removed necessarily name it — reading them as
 * violations would push the next author to delete the explanation instead of the code.
 */
const codeOf = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
    .join('\n');

const SURFACES = [
  'components/layout/Header.tsx',           // desktop tab pills + the mode menu
  'components/app-shell/bottom-tab-bar.tsx',// mobile bottom bar
  'components/ui/CommandPalette.tsx',       // ⌘K entries
  'components/ui/ShortcutsHelp.tsx',        // the shortcut cheat sheet
  'hooks/useKeyboardShortcuts.ts',          // the global ⌘3 binding
  'hooks/useCodeTab.ts',                    // the Code-tab-local ⌘3 binding
  'components/project/project-workspace.tsx', // the tab → surface router
];

describe('the preview surfaces are gone', () => {
  it.each(SURFACES)('%s offers no preview affordance', (rel) => {
    // A live reference would be a tab id, a label, or a route param.
    expect(codeOf(read(rel))).not.toMatch(/'preview'|"preview"|label: 'Preview'|tab=preview/i);
  });

  it('the tab union itself no longer contains preview', () => {
    const ctx = read('contexts/app-context.tsx');
    expect(ctx).toContain('export type AppTab = "chat" | "code" | "server";');
  });

  it('the product preview component is deleted, not merely unreferenced', () => {
    expect(() => read('components/preview/preview-tab.tsx')).toThrow();
  });

  it('nothing in the app imports a preview tab component', () => {
    for (const rel of SURFACES) {
      expect(read(rel)).not.toContain('components/preview/');
    }
  });

  it('no surface promises a preview is coming — removal is not a deferral', () => {
    for (const rel of SURFACES) {
      expect(codeOf(read(rel))).not.toMatch(/bald verfügbar|coming soon|demnächst/i);
    }
  });

  it('the first-run tour does not point at a tab that no longer exists', () => {
    expect(codeOf(read('components/onboarding/first-run-tour.tsx'))).not.toMatch(/Vorschau|preview/i);
  });
});
