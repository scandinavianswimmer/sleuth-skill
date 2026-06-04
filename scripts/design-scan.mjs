#!/usr/bin/env node
// Static "screams-AI" design tells from source. Zero dependencies. Best-effort heuristics.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.sleuth', 'coverage', '.turbo']);
const EXTS = ['.css', '.scss', '.sass', '.less', '.js', '.jsx', '.ts', '.tsx', '.html', '.htm', '.vue', '.svelte', '.astro'];

export function walk(root, exts = EXTS) {
  const out = [];
  (function rec(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) { if (IGNORE.has(e.name) || e.name.startsWith('.')) continue; rec(full); }
      else if (exts.some((x) => e.name.endsWith(x))) out.push(full);
    }
  })(root);
  return out;
}

export function fontFamilies(text) {
  const fams = new Set();
  const re = /font-family\s*:\s*((?:[^;}]+))/gi;
  let m;
  while ((m = re.exec(text))) {
    const first = m[1].split(',')[0].trim().replace(/["']/g, '');
    if (first && !/^(inherit|initial|unset|var\(|--)/i.test(first)) fams.add(first.toLowerCase());
  }
  return [...fams];
}

export function distinctHexColors(text) {
  const set = new Set();
  const re = /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi;
  let m;
  while ((m = re.exec(text))) set.add(m[0].toLowerCase());
  return [...set];
}

export function zIndexMagic(text) {
  const vals = new Set();
  let m;
  const re1 = /z-index\s*:\s*(\d{3,})/gi;
  while ((m = re1.exec(text))) { const v = +m[1]; if (v >= 100) vals.add(v); }
  const re2 = /z-\[(\d{3,})\]/g;
  while ((m = re2.exec(text))) { const v = +m[1]; if (v >= 100) vals.add(v); }
  return [...vals];
}

export function scanDesign(root) {
  const files = walk(root);
  const fams = new Set(), colors = new Set(), zmagic = new Set();
  let importantCount = 0, missingAlt = 0, allCapsCandidates = 0, glassmorphism = 0, aiPurpleGradient = 0;
  let htmlSeen = false, langSeen = false;
  for (const f of files) {
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    fontFamilies(src).forEach((x) => fams.add(x));
    distinctHexColors(src).forEach((x) => colors.add(x));
    zIndexMagic(src).forEach((x) => zmagic.add(x));
    importantCount += (src.match(/!important/g) || []).length;
    allCapsCandidates += (src.match(/text-transform\s*:\s*uppercase/gi) || []).length;
    allCapsCandidates += (src.match(/class(Name)?="[^"]*\buppercase\b[^"]*"/g) || []).length;
    glassmorphism += (src.match(/backdrop-filter|backdrop-blur/gi) || []).length;
    for (const tag of (src.match(/<img\b[^>]*>/gi) || [])) if (!/\balt\s*=/.test(tag)) missingAlt++;
    if (/(linear|radial)-gradient\([^)]*(#8b5cf6|#7c3aed|#a855f7|#6366f1|rebeccapurple|\bviolet\b|\bpurple\b|\bindigo\b|\bfuchsia\b)/i.test(src)) aiPurpleGradient++;
    if (/bg-gradient-to-[a-z]+[^"']*\b(from|via|to)-(purple|violet|indigo|fuchsia)-\d/.test(src)) aiPurpleGradient++;
    for (const tag of (src.match(/<html\b[^>]*>/gi) || [])) { htmlSeen = true; if (/\blang\s*=/.test(tag)) langSeen = true; }
  }
  return {
    fontFamilies: [...fams],
    fontFamilyCount: fams.size,
    colorCount: colors.size,
    zIndexMagic: [...zmagic],
    importantCount,
    missingAlt,
    allCapsCandidates,
    glassmorphism,
    aiPurpleGradient,
    missingLang: htmlSeen ? !langSeen : false,
    fileCount: files.length,
  };
}

function main() {
  const root = process.argv[2] || process.cwd();
  process.stdout.write(JSON.stringify(scanDesign(root), null, 2) + '\n');
}
if (import.meta.url === `file://${process.argv[1]}`) main();
