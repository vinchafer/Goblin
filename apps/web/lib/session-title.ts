// A.3 (NAVFIX-3): content-aware session titles — a cheap, client-side heuristic,
// NO model/agent call. Sessions used to be "Neue Session" / "Aus dem Chat" /
// "Session N" — non-unique and meaningless (the founder saw "Session 2" twice).
// We derive a short, honest title from the first user prompt, or fall back to the
// primary file path, so a session reads like the task it represents.

/** Placeholder names a fresh/auto-created session may carry until it has content. */
const PLACEHOLDER = /^(neue session|aus dem chat|session\s*\d+)$/i;

/** True if the name is a generic placeholder safe to overwrite with a real title. */
export function isPlaceholderTitle(name: string | null | undefined): boolean {
  if (!name) return true;
  return PLACEHOLDER.test(name.trim());
}

/** Strip a leading filename comment (`<!-- index.html -->`, `// src/App.tsx`). */
function stripLeadingComment(s: string): string {
  return s
    .replace(/^\s*<!--.*?-->/s, '')
    .replace(/^\s*(?:\/\/|#)[^\n]*/g, '')
    .trim();
}

/** Title from a file path: the base name without directory, kept readable. */
export function titleFromPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = path.split('/').pop()?.trim();
  if (!base) return null;
  return base.slice(0, 48);
}

/**
 * Derive a short title from a free-text prompt. Takes the first meaningful words
 * of the first line, capped to a sensible length. Returns null if nothing usable.
 */
export function titleFromPrompt(prompt: string | null | undefined): string | null {
  if (!prompt) return null;
  const firstLine = stripLeadingComment(prompt).split('\n').map(l => l.trim()).find(Boolean);
  if (!firstLine) return null;
  // Collapse whitespace, drop code fences / stray markup.
  const cleaned = firstLine.replace(/```+/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  const MAX = 42;
  if (cleaned.length <= MAX) return cleaned;
  // Cut on a word boundary near the limit, add an ellipsis.
  const cut = cleaned.slice(0, MAX);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim() + '…';
}

/**
 * Best title from whatever we have: prompt first (it describes the task), else
 * the primary file path. Returns null when neither yields anything.
 */
export function deriveSessionTitle(opts: { prompt?: string | null; filePath?: string | null }): string | null {
  return titleFromPrompt(opts.prompt) ?? titleFromPath(opts.filePath);
}
