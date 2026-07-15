/**
 * PWA icon set — flat gold Goblin mark, centered on flat deep-green, all sizes.
 *
 * Source: apps/web/public/brand/logo/goblin-logo-gold.svg — a single flat
 * `fill="#D4A737"` path, no filter / gradient / shadow (verified: the mark is a
 * clean flat fill, so there is nothing to strip). The green is the flat brand
 * token #0F2B1E, full-bleed to the square edge; the OS applies its own rounding.
 *
 * Composition (fixes the FW5 execution — the shipped set rendered the mark
 * full-bleed at ~86% of the tile, horns at the edge, which read heavy/"3D" under
 * the iOS corner mask):
 *   - every tile = flat green square + flat gold mark, centered
 *   - the mark is trimmed to its true bounding box, then sized to ~63% of the
 *     tile WIDTH (≈68% tall — the mark is taller than wide), giving even margin
 *     all around; horns sit comfortably inside, well clear of the mask
 *   - favicons use a larger fraction for tiny-size legibility (noted below)
 *   - badge-72 = flat gold mark on transparent (Android tints it)
 *
 *   any 192/512          → flat green + centered mark (~63% width)
 *   maskable 192/512     → identical (motif well inside the inner-80% safe zone)
 *   apple-touch 180      → flat green PNG (iOS ignores SVG apple icons)
 *   favicon 16/32/48 PNG → larger mark (~74% / 74% / 68% width) for legibility
 *   favicon.ico          → 16+32+48 packed (PNG-in-ICO)
 *   badge-72             → gold mark on transparent
 *
 * Deterministic (no network, no random). Run:
 *   node scripts/gen-pwa-icons.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const brand = resolve(root, 'apps/web/public/brand/logo');
const outIcons = resolve(root, 'apps/web/public/icons');
const outRoot = resolve(root, 'apps/web/public');
mkdirSync(outIcons, { recursive: true });

const GREEN = '#0F2B1E';
const goldSvg = readFileSync(resolve(brand, 'goblin-logo-gold.svg'));

// Render the flat gold mark at high resolution, then trim the transparent
// padding baked into the 570×570 viewBox so we can size the *true* motif.
const HIRES = 1600;
const motifPadded = await sharp(goldSvg, { density: 1024 })
  .resize(HIRES, HIRES, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
const motif = await sharp(motifPadded).trim({ threshold: 1 }).png().toBuffer();
const motifMeta = await sharp(motif).metadata();
const ASPECT = motifMeta.width / motifMeta.height; // ≈ 0.927 (taller than wide)

/**
 * Flat green square (or transparent) + the flat gold mark centered, sized so the
 * mark's WIDTH is `widthFrac` of the tile. Returns the written path.
 */
async function compose(size, widthFrac, outPath, { transparent = false } = {}) {
  const markW = Math.max(1, Math.round(size * widthFrac));
  const scaled = await sharp(motif)
    .resize({ width: markW }) // height follows aspect
    .png()
    .toBuffer();
  const base = transparent
    ? sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    : sharp({ create: { width: size, height: size, channels: 4, background: GREEN } });
  await base.composite([{ input: scaled, gravity: 'centre' }]).png().toFile(outPath);
  return outPath;
}

/** Minimal PNG-in-ICO encoder (16/32/48 — all modern browsers accept PNG payloads). */
function buildIco(pngs /* [{size, buffer}] */) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + 16 * pngs.length;
  pngs.forEach((p, i) => {
    const e = 16 * i;
    dir.writeUInt8(p.size >= 256 ? 0 : p.size, e + 0); // width
    dir.writeUInt8(p.size >= 256 ? 0 : p.size, e + 1); // height
    dir.writeUInt8(0, e + 2); // palette
    dir.writeUInt8(0, e + 3); // reserved
    dir.writeUInt16LE(1, e + 4); // color planes
    dir.writeUInt16LE(32, e + 6); // bits per pixel
    dir.writeUInt32LE(p.buffer.length, e + 8); // size of data
    dir.writeUInt32LE(offset, e + 12); // offset
    offset += p.buffer.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.buffer)]);
}

// ~63% of tile width for the home-screen / launcher icons: even margin, calm,
// horns clear of the corner mask. Identical for "any" and "maskable".
const BIG = 0.63;

const made = [];
made.push(await compose(192, BIG, resolve(outIcons, 'icon-192.png')));
made.push(await compose(512, BIG, resolve(outIcons, 'icon-512.png')));
made.push(await compose(192, BIG, resolve(outIcons, 'icon-192-maskable.png')));
made.push(await compose(512, BIG, resolve(outIcons, 'icon-512-maskable.png')));
made.push(await compose(180, BIG, resolve(outRoot, 'apple-touch-icon.png')));
// Favicons: bump the mark up at tiny sizes so the silhouette stays legible.
made.push(await compose(48, 0.68, resolve(outIcons, 'favicon-48.png')));
made.push(await compose(32, 0.74, resolve(outIcons, 'favicon-32.png')));
made.push(await compose(16, 0.74, resolve(outIcons, 'favicon-16.png')));
// Notification badge: mark on transparent (Android applies its own tint).
made.push(await compose(72, 0.72, resolve(outIcons, 'badge-72.png'), { transparent: true }));

// favicon.ico (16 + 32 + 48, packed) — classic /favicon.ico request.
const icoPngs = await Promise.all(
  [16, 32, 48].map(async (s) => ({
    size: s,
    buffer: await compose(s, s <= 32 ? 0.74 : 0.68, resolve(outIcons, `._ico_${s}.png`)),
  })),
).then((arr) =>
  Promise.all(
    arr.map(async (a) => ({ size: a.size, buffer: readFileSync(a.buffer) })),
  ),
);
writeFileSync(resolve(outRoot, 'favicon.ico'), buildIco(icoPngs));
made.push(resolve(outRoot, 'favicon.ico'));

for (const p of made) {
  if (p.endsWith('.ico')) {
    console.log(`ico(16,32,48)  ${p.replace(root + '/', '')}`);
    continue;
  }
  const meta = await sharp(p).metadata();
  console.log(`${meta.width}x${meta.height}  ${p.replace(root + '/', '')}`);
}
console.log(`\nmark aspect (w/h) = ${ASPECT.toFixed(4)}; big icons: mark ${(BIG * 100).toFixed(0)}% wide (~${(BIG / ASPECT * 100).toFixed(0)}% tall)`);
console.log(`${made.length} outputs written.`);
