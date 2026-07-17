// WAVE-E E1 — Structure-aware context: a lightweight ES-module import/export graph.
//
// Today the model sees project files as a FLAT list with raw contents budget-capped
// (project-context.ts, M2). That neither scales to a real multi-file project (it
// overflows the 48k-char budget and sheds files "smallest-first") nor exposes the
// dependency EDGES the model needs to reason across a structured project ("add a
// component, wire it into the router, keep the build green").
//
// This module parses each text source's import/export/require statements (a static
// regex scan — the same class of work as project-context's existing `referencedPaths`
// HTML-attribute regex, extended to ES-module specifiers; no AST/transpile for v1) and
// emits a COMPACT one-line-per-file summary: local edges + external packages + exports.
// The graph is the MAP; full file bodies are fetched on demand via the existing
// (Wave-D-sandboxed) read_file tool. Measured ~25-30x cheaper than full-content
// injection on a 15-file project — see M14 in the consumption ledger.
//
// LIVE-USER rule: this is additive behind detection. `hasModuleEdges()` is false for a
// vanilla static HTML/CSS/JS project (no import/export/require) → the caller renders NO
// graph block → the static-path prompt stays byte-identical. Only a project that
// actually has module structure gets the new block.

/** Source extensions we scan for module edges. */
const SCANNABLE = new Set(['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'vue', 'svelte']);

/** Candidate suffixes tried when resolving an extensionless local import. */
const RESOLVE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte', '.json'];
const INDEX_FILES = RESOLVE_EXTS.map((e) => `/index${e}`);

export interface FileForGraph {
  path: string;
  /** Text content, when available. Absent/null = not parsed (binary or not loaded). */
  content?: string | null;
}

export interface FileNode {
  path: string;
  /** Resolved LOCAL edges (project files this file imports), deduped, sorted. */
  imports: string[];
  /** Bare external package specifiers this file pulls in (deduped, sorted). */
  packages: string[];
  /** Named + default exports this file declares (deduped, sorted). */
  exports: string[];
  /** True when the source referenced an import/export/require the resolver could not
   *  map to a project file (kept for honesty — never silently dropped). */
  unresolved: string[];
}

export interface ImportGraph {
  nodes: FileNode[];
}

function extOf(path: string): string {
  const base = path.split('/').pop() ?? path;
  const dot = base.lastIndexOf('.');
  return dot === -1 ? '' : base.slice(dot + 1).toLowerCase();
}

function isScannable(path: string): boolean {
  return SCANNABLE.has(extOf(path));
}

/** Normalize a bare specifier to its package name: `@scope/pkg/sub` → `@scope/pkg`,
 *  `pkg/sub/path` → `pkg`. Leaves already-bare names untouched. */
export function packageName(specifier: string): string {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return parts.slice(0, 2).join('/');
  }
  return specifier.split('/')[0] ?? specifier;
}

/** All module specifiers referenced by a source, in source order (deduped). Covers
 *  static import (incl. `import 'x'` and `import type`), re-export (`export … from`),
 *  dynamic `import('x')`, and CommonJS `require('x')`. */
export function extractSpecifiers(content: string): string[] {
  const specs: string[] = [];
  const push = (s: string | undefined): void => {
    if (s && !specs.includes(s)) specs.push(s);
  };
  // import ... from 'x'  |  export ... from 'x'  (the `from '<spec>'` tail covers both)
  for (const m of content.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) push(m[1]);
  // side-effect import 'x'  (no `from`)
  for (const m of content.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) push(m[1]);
  // dynamic import('x')
  for (const m of content.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) push(m[1]);
  // require('x')
  for (const m of content.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) push(m[1]);
  return specs;
}

/** Named + default exports declared by a source (deduped, source order). Best-effort
 *  static scan: `export default`, `export const/let/var/function/class NAME`, and the
 *  names inside `export { a, b as c }` (the RE-EXPORT `export … from` case is left to
 *  the edge extractor, not counted as a local export). */
export function extractExports(content: string): string[] {
  const names: string[] = [];
  const push = (s: string | undefined): void => {
    if (s && !names.includes(s)) names.push(s);
  };
  if (/\bexport\s+default\b/.test(content)) push('default');
  for (const m of content.matchAll(/\bexport\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/g)) {
    push(m[1]);
  }
  // export { a, b as c }  — but NOT `export { a } from '…'` (that's a re-export edge)
  for (const m of content.matchAll(/\bexport\s*\{([^}]*)\}(?!\s*from)/g)) {
    const inner = m[1] ?? '';
    for (const part of inner.split(',')) {
      const token = part.trim();
      if (!token) continue;
      // `a as b` exports as `b`; plain `a` exports as `a`.
      const asMatch = token.match(/\bas\s+([A-Za-z_$][\w$]*)/);
      push(asMatch ? asMatch[1] : token.replace(/^type\s+/, '').trim());
    }
  }
  return names;
}

/** Resolve a relative/absolute specifier to an actual project file path, or null.
 *  Tries exact, then each RESOLVE_EXT, then /index.<ext>. `known` is the set of all
 *  project file paths. */
export function resolveLocalImport(fromPath: string, specifier: string, known: Set<string>): string | null {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return null; // bare = external
  const fromDir = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/')) : '';
  const joined = specifier.startsWith('/')
    ? specifier.slice(1)
    : normalizePath(fromDir, specifier);
  if (known.has(joined)) return joined;
  for (const ext of RESOLVE_EXTS) {
    if (known.has(joined + ext)) return joined + ext;
  }
  for (const idx of INDEX_FILES) {
    if (known.has(joined + idx)) return joined + idx;
  }
  return null;
}

/** Resolve `../a/./b` against a base dir into a clean project-relative path. */
function normalizePath(baseDir: string, rel: string): string {
  const segments = (baseDir ? baseDir.split('/') : []).concat(rel.split('/'));
  const out: string[] = [];
  for (const seg of segments) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
}

/** Build the import graph for a set of files. Only scannable sources with loaded
 *  content contribute a node; everything else is ignored (kept flat by the caller). */
export function buildImportGraph(files: FileForGraph[]): ImportGraph {
  const known = new Set(files.map((f) => f.path));
  const nodes: FileNode[] = [];
  for (const f of files) {
    if (!isScannable(f.path) || f.content == null) continue;
    const specs = extractSpecifiers(f.content);
    const imports = new Set<string>();
    const packages = new Set<string>();
    const unresolved = new Set<string>();
    for (const spec of specs) {
      if (spec.startsWith('.') || spec.startsWith('/')) {
        const resolved = resolveLocalImport(f.path, spec, known);
        if (resolved) imports.add(resolved);
        else unresolved.add(spec);
      } else {
        packages.add(packageName(spec));
      }
    }
    nodes.push({
      path: f.path,
      imports: [...imports].sort(),
      packages: [...packages].sort(),
      exports: extractExports(f.content),
      unresolved: [...unresolved].sort(),
    });
  }
  return { nodes };
}

/** True when the project has any parseable module structure — the detection gate that
 *  keeps the static path byte-identical (no edges → caller renders no graph block). */
export function hasModuleEdges(files: FileForGraph[]): boolean {
  return buildImportGraph(files).nodes.some(
    (n) => n.imports.length > 0 || n.packages.length > 0 || n.exports.length > 0,
  );
}

/** Render the graph as the compact prompt block. One line per file:
 *   `path · nutzt: a, b · Pakete: react · exportiert: default, Foo`
 *  Only non-empty facets are shown, so a leaf module stays short. Returns '' when the
 *  graph has no node with any edge (caller then renders nothing — static path intact). */
export function renderImportGraph(graph: ImportGraph): string {
  const meaningful = graph.nodes.filter(
    (n) => n.imports.length > 0 || n.packages.length > 0 || n.exports.length > 0 || n.unresolved.length > 0,
  );
  if (meaningful.length === 0) return '';
  const lines: string[] = [
    'Projektstruktur (Abhängigkeitsgraph — wer importiert wen). Nutze dies zur Orientierung; den vollständigen Inhalt einer Datei bekommst du mit read_file:',
  ];
  for (const n of meaningful) {
    const parts: string[] = [n.path];
    if (n.imports.length) parts.push(`nutzt: ${n.imports.join(', ')}`);
    if (n.packages.length) parts.push(`Pakete: ${n.packages.join(', ')}`);
    if (n.exports.length) parts.push(`exportiert: ${n.exports.join(', ')}`);
    if (n.unresolved.length) parts.push(`ungelöst: ${n.unresolved.join(', ')}`);
    lines.push(`- ${parts.join(' · ')}`);
  }
  return lines.join('\n');
}

/** Convenience: build + render in one call. '' when there is no module structure. */
export function renderProjectGraph(files: FileForGraph[]): string {
  return renderImportGraph(buildImportGraph(files));
}
