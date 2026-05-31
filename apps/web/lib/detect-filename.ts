// Smart filename detection for Send-to-Code (Sprint 5 Phase 3 / R1 fix).
// The previous fallback produced extensionless names like "html-snippet" /
// "generated-code.js", which are not deployable as a real page (Vercel needs
// index.html etc). Derive a sensible, deployable filename from content first,
// language second. Filename quality is secondary to persistence (authority 13g) —
// the last resort is snippet.txt, never an extensionless buffer name.

export function detectFilename(content: string, language?: string): string {
  const src = (content || '').trim();
  const lang = (language || '').toLowerCase();

  // Full HTML document → index.html (the headline chat→ship case)
  if (/^<!doctype html/i.test(src) || /<html[\s>]/i.test(src) || lang === 'html') {
    return 'index.html';
  }
  // JSON
  if (lang === 'json' || (/^[\s]*[{[]/.test(src) && /[}\]][\s]*$/.test(src) && isLikelyJson(src))) {
    return 'data.json';
  }
  // React / JSX / TSX component
  if (lang === 'tsx' || lang === 'jsx' || /\bimport\s+React\b/.test(src) || /export\s+default\s+function\s+[A-Z]/.test(src)) {
    return lang === 'jsx' ? 'Component.jsx' : 'Component.tsx';
  }
  // TypeScript
  if (lang === 'ts' || lang === 'typescript' || /:\s*(string|number|boolean)\b/.test(src) && /\b(interface|type)\s+[A-Z]/.test(src)) {
    return 'script.ts';
  }
  // CSS
  if (lang === 'css' || (/[.#]?[\w-]+\s*\{[^}]*:[^}]*\}/.test(src) && !/function|=>|;\s*$/.test(src.split('\n')[0] || ''))) {
    return 'styles.css';
  }
  // Python
  if (lang === 'python' || lang === 'py' || /^\s*(def|class|import|from)\s/m.test(src)) {
    return 'main.py';
  }
  // Markdown
  if (lang === 'md' || lang === 'markdown') return 'README.md';
  // JavaScript (functions/const, no markup)
  if (lang === 'js' || lang === 'javascript' || /\b(function|const|let|var)\b/.test(src)) {
    return 'script.js';
  }
  // Last resort — a real, persistable text file (never an extensionless buffer name)
  return 'snippet.txt';
}

function isLikelyJson(src: string): boolean {
  try { JSON.parse(src); return true; } catch { return false; }
}
