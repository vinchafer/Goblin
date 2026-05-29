import { createHighlighter, type Highlighter } from 'shiki';
import goblinLight from './goblin-light.json';

const THEME = 'goblin-light';
const LANGS = ['typescript', 'javascript', 'json', 'html', 'css', 'bash', 'python', 'markdown'] as const;

// Cache the highlighter on globalThis so it survives HMR in dev and is built
// only once per process. createHighlighter is async + heavy (loads wasm + grammars).
const g = globalThis as unknown as { __goblinHighlighter?: Promise<Highlighter> };

function getHighlighter(): Promise<Highlighter> {
  if (!g.__goblinHighlighter) {
    g.__goblinHighlighter = createHighlighter({
      themes: [goblinLight as Parameters<typeof createHighlighter>[0]['themes'][number]],
      langs: [...LANGS],
    });
  }
  return g.__goblinHighlighter;
}

/**
 * Highlight `code` with the goblin-light theme, returning shiki's HTML string.
 * Unknown languages fall back to plaintext (still wrapped in <pre><code>), never throws.
 */
export async function highlight(code: string, lang: string): Promise<string> {
  const hl = await getHighlighter();
  const loaded = hl.getLoadedLanguages();
  const useLang = loaded.includes(lang as (typeof LANGS)[number]) ? lang : 'text';
  return hl.codeToHtml(code, { lang: useLang, theme: THEME });
}
