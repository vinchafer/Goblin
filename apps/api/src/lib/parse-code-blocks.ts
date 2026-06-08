// Parse fenced code blocks out of an AI response and resolve a filename for each.
// Tolerant by design — models format filenames inconsistently. Recognised forms:
//   ```html\n<!-- index.html -->\n...        (HTML comment)
//   ```tsx\n// src/App.tsx\n...             (slash comment)
//   ```py\n# main.py\n...                   (hash comment)
//   ```css /* styles.css */\n...            (block comment, same or info line)
//   ```ts:src/lib/x.ts\n...                 (colon-suffixed info string)
//   ```json\n{...}                          (no name → inferred from language)
// Never throws. Unknown languages fall back to a numbered scratch file.

export interface ParsedBlock {
  path: string;
  content: string;
  lang: string;
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

function extractFilenameFromFirstLine(line: string): string | null {
  const trimmed = line.trim();
  // <!-- file --> or /* file */
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

export function parseCodeBlocks(text: string): ParsedBlock[] {
  if (!text) return [];
  const blocks: ParsedBlock[] = [];
  const fence = /```([^\n`]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let scratchN = 0;
  const usedPaths = new Set<string>();

  while ((match = fence.exec(text)) !== null) {
    const info = (match[1] ?? '').trim();
    let body = match[2] ?? '';

    // Language = first token of the info string; rest may carry a `:filename`.
    const langToken = info.split(/[\s:]/)[0]?.toLowerCase() ?? '';
    let path: string | null = null;

    // Form: ```ts:src/x.ts  or  ```html title=index.html
    const colonIdx = info.indexOf(':');
    if (colonIdx >= 0) {
      const after = info.slice(colonIdx + 1).match(FILENAME_RE);
      if (after) path = after[0] ?? null;
    }
    if (!path) {
      const titled = info.match(/(?:title|file|filename)=([A-Za-z0-9_\-./]+\.[A-Za-z0-9]+)/i);
      if (titled) path = titled[1] ?? null;
    }

    // Form: filename on the first body line as a comment.
    if (!path) {
      const firstNl = body.indexOf('\n');
      const firstLine = firstNl >= 0 ? body.slice(0, firstNl) : body;
      const fromComment = extractFilenameFromFirstLine(firstLine);
      if (fromComment) {
        path = fromComment;
        body = firstNl >= 0 ? body.slice(firstNl + 1) : '';
      }
    }

    // Fallback: infer from language, else scratch.
    let inferred = false;
    if (!path) {
      inferred = true;
      path = LANG_EXT[langToken] ?? `scratch${scratchN ? '-' + scratchN : ''}.txt`;
      if (LANG_EXT[langToken] === undefined) scratchN++;
    }

    // De-dupe identical inferred paths within one response.
    let finalPath = path;
    let n = 1;
    while (usedPaths.has(finalPath)) {
      const dot = path.lastIndexOf('.');
      finalPath = dot > 0 ? `${path.slice(0, dot)}-${n}${path.slice(dot)}` : `${path}-${n}`;
      n++;
    }
    usedPaths.add(finalPath);

    const content = body.replace(/\n$/, '');
    if (content.trim()) blocks.push({ path: finalPath, content, lang: langToken, inferred });
  }

  return blocks;
}
