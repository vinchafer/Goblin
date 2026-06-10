// WALK2-1 — deploy-stale root-cause fix (see sprint-codetab/walk2/DEPLOY_TRACE_2.md).
// A css/js edit must land on the asset the page's HTML actually links. The
// generator emitted `index.html` linking `style.css` while css blocks are named
// `styles.css` (the parse-code-blocks LANG_EXT default) — so edits wrote to an
// UNLINKED sibling, the linked `style.css` 404'd, and the live page never changed.
// Reconcile a parsed block's path to the linked href when they diverge.

/**
 * Extract the LOCAL assets an HTML document links — stylesheet hrefs and script
 * srcs — normalised to a project-relative path (no leading `./` or `/`; absolute
 * http(s)/protocol-relative/data URLs and fragments dropped).
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

interface PathBlock { path: string }

/**
 * Retarget css/js blocks to the asset the HTML links, in place. Only fires when
 * the session HTML links EXACTLY ONE asset of that type (ambiguous/multi-asset
 * projects are left untouched) and the block's path isn't already a linked href.
 * One retarget per asset type. Mutates and returns `blocks`.
 */
export function reconcileBlockPaths<T extends PathBlock>(
  blocks: T[],
  htmlFiles: Array<{ path: string; content: string }>,
): T[] {
  const linkedCss = new Set<string>();
  const linkedJs = new Set<string>();
  for (const f of htmlFiles) {
    if (!/\.html?$/i.test(f.path)) continue;
    const a = linkedLocalAssets(f.content);
    a.css.forEach((x) => linkedCss.add(x));
    a.js.forEach((x) => linkedJs.add(x));
  }
  const retarget = (linked: Set<string>, re: RegExp) => {
    if (linked.size !== 1) return;
    const target = [...linked][0]!;
    for (const b of blocks) {
      if (!re.test(b.path)) continue;
      if (b.path === target || linked.has(b.path)) continue;
      b.path = target;
      break;
    }
  };
  retarget(linkedCss, /\.s?css$/i);
  retarget(linkedJs, /\.m?js$/i);
  return blocks;
}
