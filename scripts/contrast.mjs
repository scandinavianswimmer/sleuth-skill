#!/usr/bin/env node
// WCAG 2.x relative-luminance contrast math. Zero dependencies.

export function parseColor(input) {
  if (input && typeof input === 'object' && 'r' in input) return input;
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  let m;
  if ((m = s.match(/^#([0-9a-f]{3})$/))) {
    const h = m[1];
    return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) };
  }
  if ((m = s.match(/^#([0-9a-f]{6})$/))) {
    const h = m[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  if ((m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/))) {
    return { r: +m[1], g: +m[2], b: +m[3] };
  }
  return null;
}

export function relativeLuminance(color) {
  const c = parseColor(color);
  if (!c) return null;
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

export function ratio(c1, c2) {
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  if (l1 == null || l2 == null) return null;
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

export function verdict(r, opts = {}) {
  const large = !!opts.large;
  return { ratio: r, large, aa: r >= (large ? 3.0 : 4.5), aaa: r >= (large ? 4.5 : 7.0) };
}

function main() {
  const large = process.argv.includes('--large');
  const [a, b] = process.argv.slice(2).filter((x) => x !== '--large');
  if (!a || !b) { process.stderr.write('usage: contrast.mjs <color1> <color2> [--large]\n'); process.exit(2); }
  const r = ratio(a, b);
  if (r == null) { process.stderr.write('could not parse one or both colors\n'); process.exit(2); }
  const out = { ...verdict(r, { large }), ratio: Math.round(r * 100) / 100 };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}
if (import.meta.url === `file://${process.argv[1]}`) main();
