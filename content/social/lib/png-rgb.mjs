/**
 * png-rgb.mjs — minimal, dependency-free PNG transcoder.
 *
 * Why this exists: Chromium screenshots are 8-bit RGBA (PNG colour type 6).
 * Instagram composites transparency unpredictably, so the profile avatar must
 * ship with *no alpha channel at all* — not merely opaque pixels. This module
 * re-encodes an RGBA PNG as colour type 2 (truecolour, no alpha), compositing
 * any non-opaque pixel onto an explicit field colour first.
 *
 * Only Node built-ins are used (`zlib`). No new dependency.
 * Deterministic: fixed deflate level, fixed adaptive-filter tie-breaking.
 */
import zlib from 'node:zlib';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Parse a non-interlaced 8-bit PNG into { width, height, channels, pixels }. */
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
  let off = 8;
  let ihdr = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        colourType: data[9],
        interlace: data[12],
      };
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (!ihdr) throw new Error('PNG has no IHDR');
  if (ihdr.depth !== 8) throw new Error(`unsupported bit depth ${ihdr.depth}`);
  if (ihdr.interlace !== 0) throw new Error('interlaced PNG unsupported');
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr.colourType];
  if (!channels) throw new Error(`unsupported colour type ${ihdr.colourType}`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const { width, height } = ihdr;
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride);
    p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      else if (filter !== 0) throw new Error(`bad filter ${filter}`);
      cur[x] = v & 0xff;
    }
  }
  return { width, height, channels, pixels: out };
}

/** Encode 3-channel RGB pixel data as a colour-type-2 PNG. */
export function encodeRgbPng(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  const cand = [Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride)];
  for (let y = 0; y < height; y++) {
    const cur = rgb.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? rgb.subarray((y - 1) * stride, y * stride) : null;
    let best = 0, bestSum = Infinity;
    for (let f = 0; f < 5; f++) {
      let sum = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= 3 ? cur[x - 3] : 0;
        const b = prev ? prev[x] : 0;
        const c = prev && x >= 3 ? prev[x - 3] : 0;
        let v;
        if (f === 0) v = cur[x];
        else if (f === 1) v = cur[x] - a;
        else if (f === 2) v = cur[x] - b;
        else if (f === 3) v = cur[x] - ((a + b) >> 1);
        else v = cur[x] - paeth(a, b, c);
        v &= 0xff;
        cand[f][x] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) { bestSum = sum; best = f; }
    }
    raw[y * (stride + 1)] = best;
    cand[best].copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type 2 = truecolour, NO alpha channel
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  // sRGB chunk (rendering intent 0 = perceptual) + matching gAMA, so the
  // colour space is declared rather than merely assumed.
  const srgb = Buffer.from([0]);
  const gama = Buffer.alloc(4); gama.writeUInt32BE(45455, 0);
  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('sRGB', srgb),
    chunk('gAMA', gama),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Flatten an RGBA PNG onto an opaque field colour and re-encode without alpha.
 * Returns { png, width, height, nonOpaquePixels } so the caller can *prove*
 * how much (if any) transparency had to be composited away.
 */
export function flattenOntoField(pngBuffer, fieldHex) {
  const { width, height, channels, pixels } = decodePng(pngBuffer);
  const m = /^#?([0-9a-f]{6})$/i.exec(fieldHex);
  if (!m) throw new Error(`field colour must be #rrggbb, got ${fieldHex}`);
  const fr = parseInt(m[1].slice(0, 2), 16);
  const fg = parseInt(m[1].slice(2, 4), 16);
  const fb = parseInt(m[1].slice(4, 6), 16);

  const rgb = Buffer.alloc(width * height * 3);
  let nonOpaque = 0;
  for (let i = 0, o = 0; i < width * height; i++, o += 3) {
    const s = i * channels;
    let r, g, b, a;
    if (channels === 4) { r = pixels[s]; g = pixels[s + 1]; b = pixels[s + 2]; a = pixels[s + 3]; }
    else if (channels === 3) { r = pixels[s]; g = pixels[s + 1]; b = pixels[s + 2]; a = 255; }
    else if (channels === 2) { r = g = b = pixels[s]; a = pixels[s + 1]; }
    else { r = g = b = pixels[s]; a = 255; }
    if (a === 255) { rgb[o] = r; rgb[o + 1] = g; rgb[o + 2] = b; }
    else {
      nonOpaque++;
      const t = a / 255;
      rgb[o] = Math.round(r * t + fr * (1 - t));
      rgb[o + 1] = Math.round(g * t + fg * (1 - t));
      rgb[o + 2] = Math.round(b * t + fb * (1 - t));
    }
  }
  return { png: encodeRgbPng(width, height, rgb), width, height, nonOpaquePixels: nonOpaque };
}

/** Read back a PNG and report its colour type + a corner/centre pixel sample. */
export function inspectPng(buf) {
  const { width, height, channels, pixels } = decodePng(buf);
  const at = (x, y) => {
    const s = (y * width + x) * channels;
    return '#' + [pixels[s], pixels[s + 1], pixels[s + 2]]
      .map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  return {
    width, height, channels,
    hasAlpha: channels === 4 || channels === 2,
    topLeft: at(0, 0),
    centre: at(width >> 1, height >> 1),
    bottomRight: at(width - 1, height - 1),
  };
}
