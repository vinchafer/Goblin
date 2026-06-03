// Sprint 10.6-2 — split a multi-block AI message into real, separate files.
//
// The old "Send All N blocks" glued every block into ONE buffer with
// `// File: name` comment separators (ChatMessage). That produced a single,
// syntactically-invalid file (CSS after </html>) with no index.html at root, so
// Vercel deployed "Ready" bytes that 404'd. This splitter turns the blocks into a
// clean { path, content }[] with deployable names — no comment separators.
//
// Naming priority (per block):
//   1. Explicit `// File: <path>` (or #/<!-- File: -->) first line → that path
//      (stripped from content).
//   2. The block's own `filename` (from the fenced ```lang title or parser).
//   3. Language/content heuristic via detectFilename(), with two refinements:
//      - the FIRST html block becomes index.html (Vercel entry point),
//      - css/js blocks adopt the names the first HTML actually <link>s / <script>s,
//        so the deployed page loads its own assets.
//   4. detectFilename() fallback (index.html / styles.css / script.js / …).
// Duplicate names are de-duped (style.css, style-2.css, …).

import { detectFilename } from './detect-filename';

export interface ParsedBlock {
  code: string;
  language?: string;
  filename?: string;
}

export interface CodeFile {
  path: string;
  content: string;
}

const FILE_COMMENT = /^\s*(?:\/\/|#|<!--)\s*File:\s*(.+?)\s*(?:-->)?\s*$/i;

// Strip a leading `// File: <path>` marker line, returning the hint + clean body.
function stripFileComment(code: string): { hint?: string; content: string } {
  const nl = code.indexOf('\n');
  const firstLine = nl === -1 ? code : code.slice(0, nl);
  const m = firstLine.match(FILE_COMMENT);
  if (m) {
    return { hint: (m[1] ?? '').trim(), content: code.slice(nl === -1 ? code.length : nl + 1).replace(/^\n+/, '') };
  }
  return { content: code };
}

function isHtml(content: string, lang?: string): boolean {
  if ((lang || '').toLowerCase() === 'html') return true;
  return /^<!doctype html/i.test(content.trim()) || /<html[\s>]/i.test(content);
}

// Pull the first local asset names the HTML references, so the CSS/JS blocks can
// be saved under exactly those paths (otherwise the deployed page can't load them).
function extractRefs(html: string): { css?: string; js?: string } {
  const cssM = html.match(/<link[^>]+href=["']\.?\/?([^"'>:]+\.css)["']/i);
  const jsM = html.match(/<script[^>]+src=["']\.?\/?([^"'>:]+\.js)["']/i);
  return { css: cssM?.[1], js: jsM?.[1] };
}

function normalizePath(p: string): string {
  return p.trim().replace(/^\.?\//, '').replace(/^\/+/, '');
}

export function blocksToFiles(blocks: ParsedBlock[]): CodeFile[] {
  const used = new Set<string>();
  const out: CodeFile[] = [];
  let htmlSeen = false;

  // Pre-scan the first HTML block for referenced asset paths.
  let refs: { css?: string; js?: string } = {};
  for (const b of blocks) {
    const { content } = stripFileComment(b.code);
    if (isHtml(content, b.language)) { refs = extractRefs(content); break; }
  }

  const dedupe = (name: string): string => {
    const clean = normalizePath(name) || 'snippet.txt';
    if (!used.has(clean)) { used.add(clean); return clean; }
    const slash = clean.lastIndexOf('/');
    const dir = slash >= 0 ? clean.slice(0, slash + 1) : '';
    const file = slash >= 0 ? clean.slice(slash + 1) : clean;
    const dot = file.lastIndexOf('.');
    const base = dot > 0 ? file.slice(0, dot) : file;
    const ext = dot > 0 ? file.slice(dot) : '';
    let i = 2;
    while (used.has(`${dir}${base}-${i}${ext}`)) i++;
    const result = `${dir}${base}-${i}${ext}`;
    used.add(result);
    return result;
  };

  for (const b of blocks) {
    const { hint, content } = stripFileComment(b.code);
    const lang = (b.language || '').toLowerCase();

    // 1+2. Explicit marker / parser-provided filename.
    const explicit = (hint || b.filename || '').trim();
    let path: string;
    if (explicit) {
      path = dedupe(explicit);
    } else if (isHtml(content, lang)) {
      // 3a. First HTML → index.html (Vercel entry point); later HTML → page.html.
      path = dedupe(htmlSeen ? 'page.html' : 'index.html');
      htmlSeen = true;
    } else if ((lang === 'css' || detectFilename(content, lang) === 'styles.css') && refs.css) {
      // 3b. CSS adopts the name the HTML <link>s.
      path = dedupe(refs.css);
    } else if ((lang === 'js' || lang === 'javascript' || detectFilename(content, lang) === 'script.js') && refs.js) {
      // 3b. JS adopts the name the HTML <script src>s.
      path = dedupe(refs.js);
    } else {
      // 4. Heuristic fallback.
      path = dedupe(detectFilename(content, b.language));
    }
    out.push({ path, content });
  }

  return out;
}
