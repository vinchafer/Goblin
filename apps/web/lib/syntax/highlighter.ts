import { createHighlighter, type Highlighter } from 'shiki';
import goblinLight from './goblin-light.json';
import goblinDark from './goblin-dark.json';

/**
 * FOUNDER-WALK-7 · U8 (D-G) — there used to be ONE theme, and it was a light one.
 *
 * The founder, twice: "sichtbarkeit vom im chat generierten code ist weiterhin
 * furchtbar, das muss jetzt gleich gefixt werden."
 *
 * Shiki writes token colours as INLINE styles, and `goblin-light` was rendered in
 * both app themes. `globals.css` strips the theme's own background
 * (`.cb-body .shiki { background: transparent !important; }`), so those light-theme
 * colours landed on whatever `--surface-1` was — cream `#FBF7EC` in light, dark
 * green `#133224` in dark. Measured, on the dark surface:
 *
 *     entity.name.function  #133224   1.00:1   ← the background colour, exactly
 *     keyword               #1A3A2A   1.11:1
 *     default text          #3F3A2C   1.23:1
 *
 * Function names were literally invisible. And in LIGHT mode, punctuation sat at
 * 2.16:1 — which in HTML and CSS, the two languages Goblin mostly writes, is most
 * of the characters on screen.
 *
 * Why the existing dark-contrast audit could not catch this: `styles/dark-contrast.test.ts`
 * resolves pairs out of the CSS custom properties. These colours live in a JSON file
 * and reach the page as inline styles — they appear in no stylesheet, so that audit's
 * enumeration could not reach them. `syntax-contrast.test.ts` adds the axis.
 */
const LANGS = ['typescript', 'javascript', 'json', 'html', 'css', 'bash', 'python', 'markdown'] as const;

export type SyntaxTheme = 'light' | 'dark';

const THEME_NAME: Record<SyntaxTheme, string> = {
  light: 'goblin-light',
  dark: 'goblin-dark',
};

// Cache the highlighter on globalThis so it survives HMR in dev and is built
// only once per process. createHighlighter is async + heavy (loads wasm + grammars).
const g = globalThis as unknown as { __goblinHighlighter?: Promise<Highlighter> };

type ShikiTheme = Parameters<typeof createHighlighter>[0]['themes'][number];

function getHighlighter(): Promise<Highlighter> {
  if (!g.__goblinHighlighter) {
    g.__goblinHighlighter = createHighlighter({
      // BOTH themes are registered up front rather than loaded on demand: a user
      // toggling the theme must not wait on a second wasm/theme load to be able to
      // read the code they are already looking at.
      themes: [goblinLight as ShikiTheme, goblinDark as ShikiTheme],
      langs: [...LANGS],
    });
  }
  return g.__goblinHighlighter;
}

/**
 * Highlight `code`, returning shiki's HTML string.
 *
 * `theme` defaults to 'light' so a caller that has not been taught about themes
 * behaves exactly as before — the failure mode of a missed call site is the old
 * rendering, not a crash. Unknown languages fall back to plaintext (still wrapped in
 * <pre><code>), never throws.
 */
export async function highlight(code: string, lang: string, theme: SyntaxTheme = 'light'): Promise<string> {
  const hl = await getHighlighter();
  const loaded = hl.getLoadedLanguages();
  const useLang = loaded.includes(lang as (typeof LANGS)[number]) ? lang : 'text';
  return hl.codeToHtml(code, { lang: useLang, theme: THEME_NAME[theme] });
}
