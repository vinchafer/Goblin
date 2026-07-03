// U1 (feel-sprint-2): load actual project file CONTENTS for the chat system
// prompt — the model finally sees the code it is asked to evolve, instead of
// just a name+size list. Selection is budget-capped and prioritized:
//   1. index.html (the entry point users talk about most)
//   2. text files referenced by index.html (src/href)
//   3. remaining text files, smallest first
// Binary/asset files are never loaded. Files that don't fit the budget keep
// their name+size and are marked "not loaded" so the prompt's honesty rule
// (E7) still applies to them.

import { listFilesWithMeta, downloadFile } from './file-storage';

/** Total character budget for injected file contents (~12k tokens). */
export const FILE_CONTENT_BUDGET_CHARS = 48_000;

// Text formats worth showing to the model. Anything else (images, fonts,
// audio, archives, …) is treated as a binary asset and excluded.
const TEXT_EXTENSIONS = new Set([
  'html', 'htm', 'css', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'json',
  'md', 'txt', 'svg', 'xml', 'yml', 'yaml', 'toml', 'csv', 'vue', 'svelte',
  'py', 'rb', 'php', 'sh', 'sql', 'env', 'gitignore', 'webmanifest',
]);

export interface ContextFile {
  path: string;
  size: number;
  /** File content when loaded; null/undefined = not loaded (binary or over budget). */
  content?: string | null;
  /** Why the content is absent — drives the marker text in the prompt. */
  notLoaded?: 'too-large' | 'binary';
}

function extOf(path: string): string {
  const base = path.split('/').pop() ?? path;
  const dot = base.lastIndexOf('.');
  return dot === -1 ? '' : base.slice(dot + 1).toLowerCase();
}

export function isTextFile(path: string): boolean {
  return TEXT_EXTENSIONS.has(extOf(path));
}

/** Relative paths referenced by src=/href= in an HTML document, normalized. */
function referencedPaths(html: string): Set<string> {
  const refs = new Set<string>();
  for (const m of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    const raw = (m[1] ?? '').split(/[?#]/)[0] ?? '';
    if (!raw || /^(https?:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('mailto:')) continue;
    refs.add(raw.replace(/^\.\//, '').replace(/^\//, ''));
  }
  return refs;
}

/**
 * Project files with contents loaded under the budget. Returns files in the
 * original listing order (the prompt renders the list and the contents from
 * the same array). Best-effort: any storage error degrades that file to
 * name+size, never throws.
 */
export async function loadProjectContextFiles(projectId: string): Promise<ContextFile[]> {
  const meta = await listFilesWithMeta(projectId);
  const files: ContextFile[] = meta.map((f) => ({ path: f.path, size: f.size }));

  const textFiles = files.filter((f) => isTextFile(f.path));
  for (const f of files) {
    if (!isTextFile(f.path)) f.notLoaded = 'binary';
  }

  // Priority order: index.html → referenced-by-index → smallest first.
  const index = textFiles.find((f) => f.path === 'index.html');
  let remaining = FILE_CONTENT_BUDGET_CHARS;
  let refs = new Set<string>();

  const tryLoad = async (f: ContextFile): Promise<void> => {
    // Byte size is a cheap upper-bound pre-check for character length.
    if (f.size > remaining) {
      f.notLoaded = 'too-large';
      return;
    }
    try {
      const content = await downloadFile(projectId, f.path);
      if (content == null) {
        f.notLoaded = 'too-large';
        return;
      }
      if (content.length > remaining) {
        f.notLoaded = 'too-large';
        return;
      }
      f.content = content;
      remaining -= content.length;
    } catch {
      f.notLoaded = 'too-large';
    }
  };

  if (index) {
    await tryLoad(index);
    if (index.content) refs = referencedPaths(index.content);
  }

  const rest = textFiles.filter((f) => f !== index);
  const referenced = rest.filter((f) => refs.has(f.path)).sort((a, b) => a.size - b.size);
  const others = rest.filter((f) => !refs.has(f.path)).sort((a, b) => a.size - b.size);

  for (const f of [...referenced, ...others]) {
    await tryLoad(f);
  }

  return files;
}
