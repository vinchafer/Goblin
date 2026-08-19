/**
 * gates.mjs — the two checks that decide whether a slide may ship.
 *
 * Both are exported as plain, self-contained functions because they are
 * serialised into the page by Playwright. They must not close over module
 * scope.
 */

/**
 * IN-PAGE. Read back which family/weight/style each piece of rendered text
 * ACTUALLY resolved to. The font gate is then run against this, not against a
 * hand-written list: a hardcoded list either misses a face a template started
 * using, or demands one no slide renders — and a face nothing renders is never
 * 'loaded', so the gate would fail on a slide that is perfectly correct.
 */
export function collectUsedFontsInPage() {
  const seen = new Map();
  document.querySelectorAll('*').forEach((el) => {
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!text) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const family = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    const weight = String(parseInt(cs.fontWeight, 10) || 400);
    const style = cs.fontStyle === 'italic' ? 'italic' : 'normal';
    const generic = /mono/i.test(cs.fontFamily) ? 'monospace' : /serif/i.test(family) ? 'serif' : 'sans-serif';
    const key = `${family}|${weight}|${style}`;
    if (!seen.has(key)) seen.set(key, { family, weight, style, generic, sample: text.slice(0, 40) });
  });
  return [...seen.values()];
}

/**
 * IN-PAGE. Prove the real faces rendered.
 *
 * A PNG that silently fell back to a system font looks fine and is wrong, so
 * three independent things are asserted, not one:
 *
 *  1. the @font-face entries this page declared actually reached status
 *     'loaded' for every family/weight/style the slide uses;
 *  2. document.fonts.check() agrees for the same specs;
 *  3. the text measures DIFFERENTLY from the generic fallback it would have
 *     silently become. (1) and (2) can both pass while a *third* face is what
 *     the layout engine actually picked; a width that matches sans-serif to the
 *     pixel is the signature of that failure.
 *
 * The definitive fourth check — which font Chromium actually put on the glyphs —
 * cannot be asked from JS at all, and is done over CDP by the caller.
 */
export function auditFontsInPage(required) {
  const norm = (s) => String(s || '').replace(/["']/g, '').trim();
  const declared = [];
  document.fonts.forEach((f) => declared.push({
    family: norm(f.family), weight: String(f.weight), style: String(f.style), status: f.status,
  }));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const measure = (spec, text) => { ctx.font = spec; return ctx.measureText(text).width; };

  const checks = required.map((r) => {
    const loadedFaces = declared.filter(
      (d) => d.family === norm(r.family) && d.weight === String(r.weight)
          && d.style === String(r.style) && d.status === 'loaded');

    const spec = `${r.style} ${r.weight} 100px "${r.family}"`;
    const apiCheck = document.fonts.check(spec);

    const real = measure(spec, r.sample);
    const fallback = measure(`${r.style} ${r.weight} 100px ${r.generic}`, r.sample);
    const distinct = Math.abs(real - fallback) > 0.5;

    return {
      family: r.family, weight: r.weight, style: r.style, generic: r.generic,
      loadedSubsets: loadedFaces.length,
      declaredSubsets: declared.filter((d) => d.family === norm(r.family)
        && d.weight === String(r.weight) && d.style === String(r.style)).length,
      apiCheck,
      widthReal: Math.round(real * 100) / 100,
      widthFallback: Math.round(fallback * 100) / 100,
      distinctFromFallback: distinct,
      pass: loadedFaces.length > 0 && apiCheck && distinct,
    };
  });

  // Every family the page DECLARES, not just the ones this slide happens to
  // use: the stylesheet is shared, so a family smuggled into fonts.css would
  // otherwise only be caught on whichever slide first rendered in it.
  const declaredFamilies = [...new Set(declared.map((d) => d.family))].sort();
  const usedFamilies = [...new Set(required.map((r) => norm(r.family)))].sort();

  return { checks, usedFamilies, declaredFamilies };
}

/**
 * IN-PAGE. Measure every rendered text/background pairing against §A2.5.
 *
 * The background is resolved by walking ancestors until a non-transparent
 * background-color is found — the pairing a reader actually sees, not the one
 * the stylesheet nominally declares.
 */
export function auditContrastInPage() {
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((c) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const parse = (s) => {
    const m = /rgba?\(([^)]+)\)/.exec(s || '');
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a));
  const hex = (rgb) => '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('').toUpperCase();

  const effectiveBg = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a === 1) break; }
    }
    let base = [255, 255, 255];
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  };

  const rows = [];
  document.querySelectorAll('*').forEach((el) => {
    const ownText = [...el.childNodes]
      .filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!ownText) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const fgRaw = parse(cs.color);
    if (!fgRaw) return;
    const bg = effectiveBg(el);
    const fg = over(fgRaw, bg);

    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    // WCAG "large": 18pt (24px), or 14pt (18.66px) when bold.
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const threshold = large ? 3 : 4.5;

    const l1 = lum(fg), l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    rows.push({
      text: ownText.length > 48 ? ownText.slice(0, 45) + '…' : ownText,
      className: el.className || el.tagName.toLowerCase(),
      fg: hex(fg), bg: hex(bg),
      fontSize: Math.round(size * 10) / 10, fontWeight: weight, large,
      ratio: Math.round(ratio * 100) / 100, threshold,
      pass: ratio >= threshold,
    });
  });
  return rows;
}

/**
 * IN-PAGE. Catch the failure every other gate is blind to: a slide whose type
 * and imagery are individually perfect and which nonetheless renders one on top
 * of the other. Fonts pass, contrast passes, the PNG opens — and the headline
 * is behind a phone frame.
 *
 * Two questions: does anything sit outside the canvas, and does anything sit on
 * top of anything else.
 */
export function auditLayoutInPage() {
  const slide = document.querySelector('.slide');
  const canvas = slide.getBoundingClientRect();

  const boxes = [];
  document.querySelectorAll('.slide *').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const ownText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    const isMedia = el.tagName === 'IMG' || el.classList.contains('device');
    if (!ownText && !isMedia) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    // Skip wrappers that merely contain another tracked box.
    if (isMedia && el.tagName !== 'IMG' && el.querySelector('img')) return;
    boxes.push({
      label: ownText ? (ownText.length > 40 ? ownText.slice(0, 37) + '…' : ownText) : `<${el.tagName.toLowerCase()} class="${el.className}">`,
      x: r.x, y: r.y, w: r.width, h: r.height,
    });
  });

  const overflow = boxes
    .filter((b) => b.x < canvas.x - 1 || b.y < canvas.y - 1
      || b.x + b.w > canvas.x + canvas.width + 1 || b.y + b.h > canvas.y + canvas.height + 1)
    .map((b) => ({ label: b.label, box: [Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h)] }));

  const overlaps = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      // A couple of px of overlap is line-box rounding, not a collision.
      if (ox > 2 && oy > 2) overlaps.push({ a: a.label, b: b.label, area: Math.round(ox * oy) });
    }
  }

  // Box geometry alone is blind to a word too long to break: the element's box
  // stays inside the gutter while the GLYPHS run off the canvas. scrollWidth vs
  // clientWidth is what actually sees that.
  const inkOverflow = [];
  document.querySelectorAll('.slide *').forEach((el) => {
    const ownText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!ownText) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.overflow !== 'visible') return;
    // Horizontal only. Vertically, scrollHeight legitimately exceeds
    // clientHeight whenever line-height is tighter than the font's own line box
    // — which is exactly what the display step does on purpose (95px leading on
    // 86px Manrope). Treating that as overflow would fail every correct slide.
    const overX = el.scrollWidth - el.clientWidth;
    if (overX > 1) {
      inkOverflow.push({
        label: ownText.length > 40 ? ownText.slice(0, 37) + '…' : ownText,
        overX: Math.round(overX),
        fontSize: Math.round(parseFloat(cs.fontSize)),
      });
    }
  });

  return {
    canvas: { w: Math.round(canvas.width), h: Math.round(canvas.height) },
    boxes: boxes.length,
    overflow,
    overlaps,
    inkOverflow,
  };
}
