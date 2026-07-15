/**
 * FW5-U2 (F-34) — generate the full PWA icon set from the gold-on-green logo lockup.
 *
 * Source: apps/web/public/brand/logo/goblin-logo-primary.svg (full-bleed #0F2B1E green
 * rect + gold #D4A737 g-mark) and goblin-logo-gold.svg (gold mark, transparent).
 *
 *   "any" icons  → full-bleed gold-on-green (192, 512)              → the brand look
 *   "maskable"   → green bg + mark scaled into the ~66% safe zone   → never clipped
 *   apple-touch  → full-bleed 180 (iOS applies its own corner mask)
 *   favicons     → 16/32/48 full-bleed PNG fallbacks
 *   badge-72     → monochrome-ish gold mark on transparent (Android tints it)
 *
 * Deterministic (no network, no random). Run:
 *   node scripts/gen-pwa-icons.mjs
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('/home/user/Goblin/node_modules/.pnpm/sharp@0.34.5/node_modules/sharp');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const brand = resolve(root, 'apps/web/public/brand/logo');
const outIcons = resolve(root, 'apps/web/public/icons');
const outRoot = resolve(root, 'apps/web/public');
mkdirSync(outIcons, { recursive: true });

const GREEN = '#0F2B1E';
const primarySvg = readFileSync(resolve(brand, 'goblin-logo-primary.svg'));
const goldSvg = readFileSync(resolve(brand, 'goblin-logo-gold.svg'));

/** Full-bleed render of the gold-on-green lockup at NxN. */
async function fullBleed(size, outPath) {
  await sharp(primarySvg, { density: 384 })
    .resize(size, size, { fit: 'cover' })
    .png()
    .toFile(outPath);
  return outPath;
}

/** Maskable: green background + gold mark scaled to `inner` fraction, centered. */
async function maskable(size, outPath, inner = 0.66) {
  const markSize = Math.round(size * inner);
  const mark = await sharp(goldSvg, { density: 384 })
    .resize(markSize, markSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: GREEN } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toFile(outPath);
  return outPath;
}

/** Badge: gold mark on transparent (system tints it on Android). */
async function badge(size, outPath) {
  await sharp(goldSvg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);
  return outPath;
}

const made = [];
made.push(await fullBleed(192, resolve(outIcons, 'icon-192.png')));
made.push(await fullBleed(512, resolve(outIcons, 'icon-512.png')));
made.push(await maskable(192, resolve(outIcons, 'icon-192-maskable.png')));
made.push(await maskable(512, resolve(outIcons, 'icon-512-maskable.png')));
made.push(await fullBleed(180, resolve(outRoot, 'apple-touch-icon.png')));
made.push(await fullBleed(48, resolve(outIcons, 'favicon-48.png')));
made.push(await fullBleed(32, resolve(outIcons, 'favicon-32.png')));
made.push(await fullBleed(16, resolve(outIcons, 'favicon-16.png')));
made.push(await badge(72, resolve(outIcons, 'badge-72.png')));

for (const p of made) {
  const meta = await sharp(p).metadata();
  console.log(`${meta.width}x${meta.height}  ${p.replace(root + '/', '')}`);
}
console.log(`\n${made.length} icons written.`);
