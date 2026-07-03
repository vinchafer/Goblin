// P0.2/P0.3 (feel-sprint-1): extract the local (same-deploy) asset references
// from an HTML document. Used by the API's post-deploy verification (every
// referenced asset must answer 200 before "Veröffentlicht" is shown) and by
// the web Send-to-Code integrity check (referenced files must exist in the
// transferred set).

const TAG_ATTR_RE =
  /<(?:script[^>]*\ssrc|link[^>]*\shref|img[^>]*\ssrc|source[^>]*\ssrc|audio[^>]*\ssrc|video[^>]*\ssrc|iframe[^>]*\ssrc)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;

/** True when a URL points inside the same deploy (relative path, not external). */
export function isLocalRef(raw: string): boolean {
  const url = raw.trim();
  if (!url || url.startsWith('#')) return false;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)) return false; // http:, https:, data:, mailto:, protocol-relative
  return true;
}

/** Normalize a local ref to a storage-style path: strip query/hash, leading "./" and "/". */
export function normalizeLocalRef(raw: string): string {
  let p = raw.trim().split(/[?#]/, 1)[0] ?? '';
  while (p.startsWith('./')) p = p.slice(2);
  while (p.startsWith('/')) p = p.slice(1);
  return p;
}

/**
 * All local asset paths referenced by `html` (script src, link href, img/source/
 * audio/video/iframe src), normalized and deduplicated. External URLs, data:
 * URIs, and pure fragments are excluded.
 */
export function extractLocalRefs(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(TAG_ATTR_RE)) {
    const raw = m[2] ?? m[3] ?? m[4] ?? '';
    if (!isLocalRef(raw)) continue;
    const norm = normalizeLocalRef(raw);
    if (norm) out.add(norm);
  }
  return [...out];
}
