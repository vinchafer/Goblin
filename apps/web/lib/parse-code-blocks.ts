// Frontend mirror of apps/api/src/lib/parse-code-blocks.ts — used for the LIVE
// typewriter: as stream deltas arrive, we re-parse the accumulating text so the
// editor shows code appearing block-by-block. The backend re-parses the final
// text authoritatively when persisting draft files; this copy is display-only.
// Tolerant + never throws. Handles incomplete (still-streaming) trailing blocks.

export interface ParsedBlock {
  path: string;
  content: string;
  lang: string;
  complete: boolean;
  /** true = path came from the language/scratch fallback (model named no file). */
  inferred: boolean;
}

const LANG_EXT: Record<string, string> = {
  html: 'index.html', htm: 'index.html',
  css: 'styles.css', scss: 'styles.scss',
  js: 'script.js', javascript: 'script.js', mjs: 'script.mjs',
  ts: 'script.ts', typescript: 'script.ts',
  jsx: 'App.jsx', tsx: 'App.tsx',
  json: 'data.json', md: 'README.md', markdown: 'README.md',
  py: 'main.py', python: 'main.py',
  sh: 'script.sh', bash: 'script.sh',
  yaml: 'config.yaml', yml: 'config.yml',
  txt: 'scratch.txt', text: 'scratch.txt',
};

const FILENAME_RE = /[A-Za-z0-9_\-./]+\.[A-Za-z0-9]+/;

function filenameFromFirstLine(line: string): string | null {
  const trimmed = line.trim();
  const comment = trimmed
    .replace(/^<!--\s*/, '').replace(/\s*-->$/, '')
    .replace(/^\/\*\s*/, '').replace(/\s*\*\/$/, '')
    .replace(/^\/\/\s*/, '').replace(/^#\s*/, '')
    .trim();
  const m = comment.match(FILENAME_RE);
  if (m && (trimmed.startsWith('<!--') || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*'))) {
    return m[0];
  }
  return null;
}

function resolveFromInfoAndBody(info: string, body: string): { path: string | null; body: string; lang: string; inferred: boolean } {
  const lang = info.split(/[\s:]/)[0]?.toLowerCase() ?? '';
  let path: string | null = null;

  const colonIdx = info.indexOf(':');
  if (colonIdx >= 0) {
    const after = info.slice(colonIdx + 1).match(FILENAME_RE);
    if (after) path = after[0] ?? null;
  }
  if (!path) {
    const titled = info.match(/(?:title|file|filename)=([A-Za-z0-9_\-./]+\.[A-Za-z0-9]+)/i);
    if (titled) path = titled[1] ?? null;
  }
  if (!path) {
    const firstNl = body.indexOf('\n');
    const firstLine = firstNl >= 0 ? body.slice(0, firstNl) : body;
    const fromComment = filenameFromFirstLine(firstLine);
    if (fromComment) {
      path = fromComment;
      body = firstNl >= 0 ? body.slice(firstNl + 1) : '';
    }
  }
  let inferred = false;
  if (!path) { inferred = true; path = LANG_EXT[lang] ?? 'scratch.txt'; }
  return { path, body, lang, inferred };
}

/**
 * WALK2-1 mirror of the API helper: the LOCAL stylesheet hrefs / script srcs an
 * HTML document links, normalised project-relative. Used to reconcile where a
 * css/js edit is written so the edit lands on the file the page actually loads.
 */
export function linkedLocalAssets(html: string): { css: Set<string>; js: Set<string> } {
  const css = new Set<string>();
  const js = new Set<string>();
  const norm = (raw: string): string | null => {
    let h = raw.trim();
    if (!h || /^(https?:)?\/\//i.test(h) || h.startsWith('data:') || h.startsWith('#')) return null;
    h = h.split(/[?#]/)[0]!.replace(/^\.?\//, '');
    return h || null;
  };
  const linkRe = /<link\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const tag = m[0];
    if (!/rel\s*=\s*["']?[^"'>]*stylesheet/i.test(tag)) continue;
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    const n = href ? norm(href) : null;
    if (n && /\.s?css$/i.test(n)) css.add(n);
  }
  const scriptRe = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  while ((m = scriptRe.exec(html)) !== null) {
    const n = norm(m[1]!);
    if (n && /\.m?js$/i.test(n)) js.add(n);
  }
  return { css, js };
}

export function parseCodeBlocks(text: string): ParsedBlock[] {
  if (!text) return [];
  const blocks: ParsedBlock[] = [];
  const used = new Set<string>();

  const pushBlock = (info: string, rawBody: string, complete: boolean) => {
    const { path, body, lang, inferred } = resolveFromInfoAndBody(info.trim(), rawBody);
    let finalPath = path ?? 'scratch.txt';
    let n = 1;
    while (used.has(finalPath)) {
      const dot = finalPath.lastIndexOf('.');
      const base = path ?? 'scratch.txt';
      const d = base.lastIndexOf('.');
      finalPath = d > 0 ? `${base.slice(0, d)}-${n}${base.slice(d)}` : `${base}-${n}`;
      n++;
      void dot;
    }
    used.add(finalPath);
    const content = body.replace(/\n$/, '');
    blocks.push({ path: finalPath, content, lang, complete, inferred });
  };

  // Walk fences manually so we can capture an unterminated trailing block (streaming).
  const fenceOpen = /```([^\n`]*)\n/g;
  let m: RegExpExecArray | null;
  while ((m = fenceOpen.exec(text)) !== null) {
    const info = m[1] ?? '';
    const bodyStart = m.index + m[0].length;
    const closeIdx = text.indexOf('\n```', bodyStart - 1);
    if (closeIdx >= 0) {
      const body = text.slice(bodyStart, closeIdx + 1);
      pushBlock(info, body, true);
      fenceOpen.lastIndex = closeIdx + 4;
    } else {
      // Unterminated — still streaming.
      const body = text.slice(bodyStart);
      pushBlock(info, body, false);
      break;
    }
  }
  return blocks;
}
