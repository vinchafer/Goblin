#!/usr/bin/env node
/**
 * render.mjs — produce Instagram graphics from the repo's real design system.
 *
 *   node content/social/render.mjs content/social/posts/<slug>
 *   node content/social/render.mjs --probe        # font-verification evidence
 *
 * Every slide is rendered twice: 1080×1350 (feed portrait) and 1080×1920
 * (story). Both are gated before they are written:
 *
 *   · FONT GATE     — four independent proofs that Manrope, Instrument Serif
 *                     and JetBrains Mono actually rendered, including asking
 *                     Chromium over CDP which font it put on the glyphs.
 *   · CONTRAST GATE — every rendered text/background pairing against §A2.5
 *                     (4.5:1 body, 3:1 large).
 *
 * A failure is fatal. A low-contrast or fallback-font slide is never written.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChromium } from './lib/browser.mjs';
import { flattenOntoField, inspectPng, decodePng } from './lib/png-rgb.mjs';
import { auditFontsInPage, auditContrastInPage, collectUsedFontsInPage, auditLayoutInPage } from './lib/gates.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const TEMPLATES = path.join(HERE, 'templates');

/**
 * Pages are served from a synthetic origin rather than file://.
 *
 * A file:// document has an opaque origin, and font loading is CORS-checked, so
 * every @font-face is dropped without a console error — the exact silent
 * fallback this renderer exists to prevent. Routing a fake https origin back to
 * the working tree keeps fonts loadable AND makes "no network fetch" provable:
 * the router serves from disk or fails, and anything it cannot resolve locally
 * is recorded as a violation rather than fetched.
 */
const ORIGIN = 'https://social.goblin.invalid';

const FORMATS = [
  { name: 'feed',  width: 1080, height: 1350 },
  { name: 'story', width: 1080, height: 1920 },
];
const DSF = 2; // render at 2× for crisp type, then supersample down to spec size

/** The only families any slide is allowed to render in. */
const ALLOWED_FAMILIES = ['Manrope', 'Instrument Serif', 'JetBrains Mono'];

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

function dataUri(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = MIME[ext];
  if (!mime) throw new Error(`unsupported image type ${ext} (${file})`);
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

/**
 * Which mark may sit on which field. Gold is forbidden as an icon on a light
 * field, so the bone surface gets the ink mark instead. This is enforced here
 * rather than left to whoever writes the post JSON.
 */
function defaultMark(surface) {
  return surface === 'bone' ? 'branding/logos/logo-black.svg' : 'branding/logos/logo-gold.svg';
}

/** Route every request to the working tree; record anything that escapes. */
async function installRouter(page, violations) {
  await page.route('**/*', async (route, request) => {
    const url = new URL(request.url());
    if (url.origin !== ORIGIN) {
      violations.push(`page tried to reach ${request.url()}`);
      return route.abort('blockedbyclient');
    }
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO + path.sep) || !fs.existsSync(file)) {
      violations.push(`page requested a path that is not in the working tree: ${url.pathname}`);
      return route.abort('blockedbyclient');
    }
    const ext = path.extname(file).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8'
      : ext === '.css' ? 'text/css; charset=utf-8'
      : ext === '.woff2' ? 'font/woff2'
      : MIME[ext] ?? 'application/octet-stream';
    return route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(file) });
  });
}

/** Ask Chromium which font it actually used for each text node. */
async function platformFonts(page) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '.slide *' });
    const used = new Map();
    for (const nodeId of nodeIds) {
      let res;
      try { res = await cdp.send('CSS.getPlatformFontsForNode', { nodeId }); } catch { continue; }
      for (const f of res.fonts ?? []) {
        if (!f.glyphCount) continue;
        const prev = used.get(f.familyName) ?? { familyName: f.familyName, glyphCount: 0, isCustomFont: f.isCustomFont };
        prev.glyphCount += f.glyphCount;
        used.set(f.familyName, prev);
      }
    }
    return [...used.values()].sort((a, b) => b.glyphCount - a.glyphCount);
  } finally {
    await cdp.detach().catch(() => {});
  }
}

/** Fill data-slot / data-slot-src, drop empties, stamp format + surface.
    Runs in-page: Playwright passes exactly one argument, so it takes a bag. */
function applyContent({ content, format, surface }) {
  const slide = document.querySelector('.slide');
  slide.setAttribute('data-format', format);
  if (surface) slide.setAttribute('data-surface', surface);
  document.documentElement.setAttribute('data-format', format);

  // "size": "sm" steps the headline down to the h1 step, for copy with a long
  // unbreakable word that will not fit the display step.
  const h = document.querySelector('.headline');
  if (h && content.size === 'sm') h.classList.add('headline--sm');

  for (const el of document.querySelectorAll('[data-slot]')) {
    const key = el.getAttribute('data-slot');
    const value = content[key];
    if (value === undefined || value === null || String(value).trim() === '') el.remove();
    else el.textContent = String(value);   // textContent: post copy is never markup
  }
  for (const el of document.querySelectorAll('[data-slot-src]')) {
    const key = el.getAttribute('data-slot-src');
    const value = content['__src__' + key];
    if (!value) el.remove(); else el.setAttribute('src', value);
  }
  // A stack or row whose children were all removed would leave a phantom gap.
  for (const el of document.querySelectorAll('.stack, .foot-row')) {
    if (!el.children.length) el.remove();
  }
}

async function renderSlide(page, flatPage, { templateFile, content, format, outFile }) {
  await page.setViewportSize({ width: format.width, height: format.height });
  await page.goto(`${ORIGIN}/${path.relative(REPO, templateFile).split(path.sep).join('/')}`, { waitUntil: 'load' });
  await page.evaluate(applyContent, { content, format: format.name, surface: content.surface ?? null });
  await page.evaluate(() => document.fonts.ready);
  // Measure the supplied screenshot and hand its ratio to the frame, so the
  // frame is cut to the picture rather than the picture floated inside a frame.
  await page.evaluate(async () => {
    const img = document.querySelector('.device__screen img');
    if (!img) return;
    await img.decode();
    img.parentElement.style.setProperty('--shot-ratio', `${img.naturalWidth} / ${img.naturalHeight}`);
  });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

  // ── Gates, before a single byte is written ──────────────────────────────
  // What the slide actually renders decides what must be proven.
  const used = await page.evaluate(collectUsedFontsInPage);
  const fonts = await page.evaluate(auditFontsInPage, used);
  const platform = await platformFonts(page);
  const contrast = await page.evaluate(auditContrastInPage);
  const layout = await page.evaluate(auditLayoutInPage);

  // Verify the poster type scale actually stood on the design system's desktop
  // step — if the media query had not matched, every size would be 1.8× the
  // MOBILE scale and the slide would be quietly, uniformly too small.
  const scale = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      displayStep: cs.getPropertyValue('--t-display-fs').trim(),
      posterScale: cs.getPropertyValue('--poster-scale').trim(),
      headlinePx: (() => {
        const h = document.querySelector('.headline');
        return h ? parseFloat(getComputedStyle(h).fontSize) : null;
      })(),
      gutterPx: parseFloat(getComputedStyle(document.querySelector('.slide')).paddingLeft),
    };
  });

  // ── The picture ─────────────────────────────────────────────────────────
  const hi = await page.screenshot({ type: 'png', animations: 'disabled' });
  const hiMeta = decodePng(hi);

  // Supersample the 2× render down to the spec size, so the shipped file is
  // exactly 1080 wide AND was typeset at 2×.
  const field = await page.evaluate(() => getComputedStyle(document.querySelector('.slide')).backgroundColor);
  const fieldHex = '#' + (/rgba?\(([^)]+)\)/.exec(field)?.[1] ?? '0,0,0')
    .split(/[,\s/]+/).filter(Boolean).slice(0, 3)
    .map((n) => Number(n).toString(16).padStart(2, '0')).join('');

  await flatPage.setViewportSize({ width: format.width, height: format.height });
  await flatPage.setContent(
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:${fieldHex}}` +
    `img{display:block;width:${format.width}px;height:${format.height}px}</style>` +
    `<img src="data:image/png;base64,${hi.toString('base64')}">`,
    { waitUntil: 'load' });
  const shot = await flatPage.screenshot({ type: 'png', animations: 'disabled' });

  const flat = flattenOntoField(shot, fieldHex);

  // Deliberately NOT written yet. "Fail the render rather than ship a bad
  // slide" has to mean the bad slide never reaches disk — otherwise a failed
  // run still leaves a fallback-font PNG sitting in the post folder, looking
  // exactly like a good one to whoever opens the folder next.
  return {
    png: flat.png,
    outFile,
    file: path.relative(REPO, outFile),
    format: format.name,
    renderedAt: `${hiMeta.width}x${hiMeta.height}`,
    ...inspectPng(flat.png),
    usedFonts: used,
    bytes: flat.png.length,
    scale,
    fonts,
    platformFonts: platform,
    contrast,
    layout,
  };
}

// ── Entry ───────────────────────────────────────────────────────────────────
const arg = process.argv[2];
if (!arg) {
  console.error('usage: node content/social/render.mjs <post-folder>\n       node content/social/render.mjs --probe');
  process.exit(2);
}

let jobs, outDir, label;
if (arg === '--probe') {
  outDir = path.join(HERE, 'probe');
  label = 'font probe';
  // Two slides, because between them they exercise every face any template can
  // reach: Manrope 800 + 400, Instrument Serif italic 400, JetBrains Mono
  // 500 + 400. Each carries the German string the founder named, so a subset
  // that dropped Latin-Extended would show up as a fallback glyph, not silence.
  const GERMAN = 'Größe · Anmeldeseite · fünf';
  jobs = [
    {
      id: 'font-probe-dark',
      template: 'type-post.html',
      content: {
        surface: null,
        eyebrow: `JetBrains Mono 500 · ${GERMAN}`,
        headline: GERMAN,
        accent: `„${GERMAN}“`,
        footer: `Manrope 800 · Instrument Serif italic 400 · JetBrains Mono 400 · ${GERMAN}`,
        badge: 'ÄÖÜ ß „ ‚ “ ”',
      },
    },
    {
      id: 'font-probe-bone',
      template: 'carousel-slide.html',
      content: {
        surface: 'bone',
        index: '02 / 02',
        eyebrow: `JetBrains Mono 500 · ${GERMAN}`,
        headline: `Manrope 800 — ${GERMAN}`,
        body: `Manrope 400 auf hellem Grund: ${GERMAN}. Typografische Anführungszeichen „so“ und ‚so‘, `
            + 'Umlaute ä ö ü Ä Ö Ü und das scharfe ß — alle aus der echten Schrift, nicht aus einem Ersatz.',
        footer: `JetBrains Mono 400 · ${GERMAN}`,
      },
    },
  ];
} else {
  const dir = path.resolve(arg);
  const manifest = path.join(dir, 'post.json');
  if (!fs.existsSync(manifest)) { console.error(`no post.json in ${dir}`); process.exit(2); }
  const post = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  outDir = dir;
  label = post.title ?? path.basename(dir);
  jobs = post.slides.map((s, i) => ({
    id: `${String(i + 1).padStart(2, '0')}-${s.template}`,
    template: `${s.template}.html`,
    content: s,
    dir,
  }));
}

const { chromium, from } = await loadChromium();
const browser = await chromium.launch();
const results = [];
const netViolations = [];
try {
  const page = await browser.newPage({ deviceScaleFactor: DSF });
  await installRouter(page, netViolations);
  // A second page at deviceScaleFactor 1 does the supersample-down pass. It has
  // to be a separate page: deviceScaleFactor is fixed for the life of a context,
  // so reusing the 2× page would photograph the 2× image at 2× again.
  const flatPage = await browser.newPage({ deviceScaleFactor: 1 });
  for (const job of jobs) {
    const templateFile = path.join(TEMPLATES, job.template);
    if (!fs.existsSync(templateFile)) throw new Error(`unknown template "${job.template}" (${templateFile})`);

    // Resolve every image to a data: URI up front — the page must not fetch.
    const content = { ...job.content };
    const surface = content.surface ?? null;
    content.__src__mark = dataUri(path.join(REPO, content.mark ?? defaultMark(surface)));
    if (content.image) {
      const p = path.isAbsolute(content.image) ? content.image
        : fs.existsSync(path.join(job.dir ?? outDir, content.image))
          ? path.join(job.dir ?? outDir, content.image)
          : path.join(REPO, content.image);
      content.__src__image = dataUri(p);
    }

    for (const format of FORMATS) {
      const outFile = path.join(outDir, `${job.id}-${format.name}-${format.width}x${format.height}.png`);
      results.push({ slide: job.id, template: job.template, ...await renderSlide(page, flatPage, { templateFile, content, format, outFile }) });
    }
  }
} finally {
  await browser.close();
}

// ── Verdict ─────────────────────────────────────────────────────────────────
const failures = [...new Set(netViolations)].map((v) => `NETWORK: ${v}`);
for (const r of results) {
  const where = `${r.slide}/${r.format}`;
  const [w, h] = r.renderedAt.split('x').map(Number);
  if (w !== 1080 * DSF) failures.push(`${where}: rendered at ${r.renderedAt}, expected ${1080 * DSF} wide (deviceScaleFactor ${DSF})`);
  if (r.width !== 1080) failures.push(`${where}: output is ${r.width}x${r.height}, expected 1080 wide`);
  if (r.hasAlpha) failures.push(`${where}: PNG carries an alpha channel`);

  if (r.scale.displayStep !== '72px') failures.push(`${where}: --t-display-fs is ${r.scale.displayStep}, expected the design system's 72px desktop step`);
  // A token drifting under us would silently reflow every post. Pin the gutter.
  if (r.scale.gutterPx !== 96) failures.push(`${where}: side gutter computed to ${r.scale.gutterPx}px, expected 96px — a spacing token moved`);

  for (const c of r.fonts.checks) {
    if (!c.pass) failures.push(
      `${where}: FONT ${c.family} ${c.style} ${c.weight} — loadedSubsets=${c.loadedSubsets} apiCheck=${c.apiCheck} distinctFromFallback=${c.distinctFromFallback} (${c.widthReal} vs ${c.widthFallback} px)`);
  }
  const strayDeclared = r.fonts.declaredFamilies.filter((f) => !ALLOWED_FAMILIES.includes(f));
  if (strayDeclared.length) failures.push(`${where}: the stylesheet declares @font-face families outside the design system: ${strayDeclared.join(', ')}`);

  // Chromium reports the family name stored INSIDE the file, which for a
  // variable font is its default-instance name — Manrope's variable file calls
  // itself "Manrope ExtraLight" whatever weight it is instanced at. Match on
  // prefix, and require the glyphs came from a webfont rather than the system.
  const custom = r.platformFonts.filter((f) => f.isCustomFont);
  const system = r.platformFonts.filter((f) => !f.isCustomFont);
  const covered = (fam) => custom.some((f) => f.familyName.toLowerCase().startsWith(fam.toLowerCase()));
  for (const fam of [...new Set(r.usedFonts.map((u) => u.family))]) {
    if (!ALLOWED_FAMILIES.includes(fam)) failures.push(`${where}: slide renders text in "${fam}", which is not a design-system family`);
    else if (!covered(fam)) failures.push(`${where}: Chromium put no glyph on ${fam} — the slide rendered in something else`);
  }
  if (system.length) failures.push(`${where}: system fonts painted glyphs: ${system.map((f) => `${f.familyName}(${f.glyphCount})`).join(', ')}`);

  for (const c of r.contrast) {
    if (!c.pass) failures.push(`${where}: CONTRAST ${c.ratio}:1 < ${c.threshold}:1 — ${c.fg} on ${c.bg}, ${c.fontSize}px/${c.fontWeight} "${c.text}"`);
  }
  for (const o of r.layout.overflow) failures.push(`${where}: LAYOUT "${o.label}" sits outside the canvas at [${o.box.join(', ')}]`);
  for (const o of r.layout.overlaps) failures.push(`${where}: LAYOUT "${o.a}" overlaps "${o.b}" over ${o.area}px²`);
  for (const o of r.layout.inkOverflow) failures.push(
    `${where}: LAYOUT "${o.label}" runs ${o.overX}px wider than its column at ${o.fontSize}px — shorten it, or set "size": "sm" on the slide`);
}

console.log(`\n${label} — playwright from ${from}, deviceScaleFactor ${DSF}\n`);
for (const r of results) {
  console.log(`── ${r.slide} · ${r.format}`);
  console.log(`   ${r.file}`);
  console.log(`   rendered ${r.renderedAt} → ${r.width}x${r.height}, alpha=${r.hasAlpha}, ${(r.bytes / 1024).toFixed(1)}KB`);
  console.log(`   scale: --t-display-fs ${r.scale.displayStep} × --poster-scale ${r.scale.posterScale} → headline ${r.scale.headlinePx}px · gutter ${r.scale.gutterPx}px`);
  console.log(`   fonts used: ${r.fonts.checks.map((c) => `${c.family.split(' ')[0]}/${c.weight}${c.style === 'italic' ? 'i' : ''}=${c.pass ? 'ok' : 'FAIL'}`).join(' ')}`);
  console.log(`   glyphs painted by: ${r.platformFonts.map((f) => `${f.familyName}${f.isCustomFont ? '' : ' [SYSTEM]'}:${f.glyphCount}`).join(', ')}`);
  console.log(`   layout: ${r.layout.boxes} box(es) on ${r.layout.canvas.w}x${r.layout.canvas.h}, ${r.layout.overflow.length} out-of-canvas, ${r.layout.overlaps.length} overlap, ${r.layout.inkOverflow.length} ink-overflow`);
  const worst = [...r.contrast].sort((a, b) => a.ratio - b.ratio)[0];
  console.log(`   contrast: ${r.contrast.length} pairing(s), all ≥ threshold = ${r.contrast.every((c) => c.pass)}` +
    (worst ? `, lowest ${worst.ratio}:1 (needs ${worst.threshold}) on "${worst.text}"` : ''));
  console.log('');
}

if (failures.length) {
  console.error(`RENDER FAILED — ${failures.length} gate failure(s):\n  ` + failures.join('\n  '));
  console.error('\nNothing was written. The previous PNGs in this folder, if any, are untouched.');
  process.exit(1);
}

// Every gate is green — only now does anything reach disk.
for (const r of results) {
  fs.mkdirSync(path.dirname(r.outFile), { recursive: true });
  fs.writeFileSync(r.outFile, r.png);
}
fs.writeFileSync(
  path.join(outDir, 'render-report.json'),
  JSON.stringify(results.map(({ png, outFile, ...rest }) => rest), null, 2) + '\n');

console.log(`OK — ${results.length} PNG(s) written to ${path.relative(REPO, outDir)}, all gates green.`);
