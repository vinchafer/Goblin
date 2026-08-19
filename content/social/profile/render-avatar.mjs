#!/usr/bin/env node
/**
 * render-avatar.mjs — render the Goblin mark to a social profile picture.
 *
 * Sources are the authored brand SVGs in `branding/icons/`. The mark is never
 * redrawn and the padding is never re-cropped: the whole SVG is scaled to the
 * output box, so the authored inset (translate(102 102) scale(1.438) inside a
 * 1024 viewBox) is preserved exactly.
 *
 * Output is flattened onto the field colour and re-encoded WITHOUT an alpha
 * channel — Instagram composites transparency unpredictably, and the source
 * SVGs carry a rounded corner (rx=230) that would otherwise ship as four
 * transparent corners.
 *
 *   node content/social/profile/render-avatar.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChromium, contrastRatio } from '../lib/browser.mjs';
import { flattenOntoField, inspectPng } from '../lib/png-rgb.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const OUT = HERE;

const FULL = 1000; // Instagram accepts up to 1080; 1000 is the founder's spec
const PROBE = 40;  // the diameter the avatar occupies inside a story ring

/**
 * Field colours are read back out of the source SVG rather than restated here,
 * so this script cannot drift from the brand assets. GOBLIN_DESIGN_SYSTEM.md
 * v1.1 locks them as --brand-green #1A3A2A and --ink-deep #0F2B1E; the same
 * values are the LOCKED anchors in apps/web/styles/design-tokens.css.
 */
const VARIANTS = [
  { name: 'avatar-green',    svg: 'branding/icons/app-icon.svg',      label: 'Brand Green' },
  { name: 'avatar-inkdeep',  svg: 'branding/icons/app-icon-dark.svg', label: 'Ink Deep' },
];

function readFieldColour(svg) {
  const m = /<rect[^>]*\bfill="(#[0-9A-Fa-f]{6})"/.exec(svg);
  if (!m) throw new Error('no field <rect fill="#..."> found in source SVG');
  return m[1].toUpperCase();
}

function readMarkColour(svg) {
  const m = /<path[^>]*\bfill="(#[0-9A-Fa-f]{6})"/.exec(svg);
  if (!m) throw new Error('no mark <path fill="#..."> found in source SVG');
  return m[1].toUpperCase();
}

async function shoot(page, html, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({ type: 'png', animations: 'disabled' });
}

const results = [];

const { chromium, from } = await loadChromium();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  for (const v of VARIANTS) {
    const svgPath = path.join(REPO, v.svg);
    const svg = fs.readFileSync(svgPath, 'utf8');
    const field = readFieldColour(svg);
    const mark = readMarkColour(svg);

    // Inline the SVG (no network, no <img> decode path) and let the page
    // background carry the same field colour, so the rounded corners flatten
    // into the field instead of into transparency.
    const full = await shoot(page, `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:${field};}
  svg{display:block;width:${FULL}px;height:${FULL}px;}
</style>${svg}`, FULL);

    const flat = flattenOntoField(full, field);
    const fullFile = path.join(OUT, `${v.name}-${FULL}.png`);
    fs.writeFileSync(fullFile, flat.png);

    // The probe must be a DOWNSCALE of the shipped raster (what Instagram
    // actually does), not a fresh rasterisation of the vector at 40px — the
    // latter would flatter the mark and hide exactly what we are probing for.
    const dataUri = 'data:image/png;base64,' + flat.png.toString('base64');
    const small = await shoot(page, `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:${field};}
  img{display:block;width:${PROBE}px;height:${PROBE}px;}
</style><img src="${dataUri}">`, PROBE);

    const flatSmall = flattenOntoField(small, field);
    const probeFile = path.join(OUT, `${v.name}-${PROBE}.png`);
    fs.writeFileSync(probeFile, flatSmall.png);

    results.push({
      variant: v.name,
      label: v.label,
      source: v.svg,
      field,
      mark,
      contrastMarkOnField: contrastRatio(mark, field),
      full: { file: path.relative(REPO, fullFile), ...inspectPng(fs.readFileSync(fullFile)), compositedPixels: flat.nonOpaquePixels, bytes: fs.statSync(fullFile).size },
      probe: { file: path.relative(REPO, probeFile), ...inspectPng(fs.readFileSync(probeFile)), compositedPixels: flatSmall.nonOpaquePixels, bytes: fs.statSync(probeFile).size },
    });
  }
} finally {
  await browser.close();
}

// ── Assertions: fail loudly rather than shipping a wrong avatar ─────────────
const failures = [];
for (const r of results) {
  for (const [kind, expect, got] of [
    ['full', FULL, r.full], ['probe', PROBE, r.probe],
  ]) {
    if (got.width !== expect || got.height !== expect) failures.push(`${r.variant} ${kind}: expected ${expect}x${expect}, got ${got.width}x${got.height}`);
    if (got.hasAlpha) failures.push(`${r.variant} ${kind}: PNG still carries an alpha channel`);
    if (got.topLeft !== r.field) failures.push(`${r.variant} ${kind}: corner is ${got.topLeft}, expected field ${r.field}`);
    if (got.bottomRight !== r.field) failures.push(`${r.variant} ${kind}: opposite corner is ${got.bottomRight}, expected field ${r.field}`);
  }
}

console.log(`playwright resolved from: ${from}\n`);
for (const r of results) {
  console.log(`── ${r.label} (${r.variant}) ── source ${r.source}`);
  console.log(`   field ${r.field} · mark ${r.mark} · mark-on-field contrast ${r.contrastMarkOnField.toFixed(2)}:1`);
  for (const k of ['full', 'probe']) {
    const g = r[k];
    console.log(`   ${g.file}  ${g.width}x${g.height}  channels=${g.channels} alpha=${g.hasAlpha}  corner=${g.topLeft} centre=${g.centre}  composited=${g.compositedPixels}px  ${(g.bytes / 1024).toFixed(1)}KB`);
  }
  console.log('');
}

fs.writeFileSync(path.join(OUT, 'render-report.json'), JSON.stringify(results, null, 2) + '\n');

if (failures.length) {
  console.error('FAILED:\n  ' + failures.join('\n  '));
  process.exit(1);
}
console.log('OK — both variants rendered, no alpha channel, corners are field colour.');
