#!/usr/bin/env node
// Classify a repo's package.json scripts into {build, test, typecheck, lint}
// so the heal loop runs the right verify commands. Zero dependencies. Best-effort.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CATEGORIES = {
  build: {
    names: [/^build$/, /(^|[:_-])build([:_-]|$)/],
    cmds: [],
    exclude: [/^pre/, /^post/],
  },
  test: {
    names: [/^test$/, /(^|[:_-])test([:_-]|$)/],
    cmds: [/\bvitest\b/, /\bjest\b/, /\bmocha\b/, /node\s+--test/, /playwright\s+test/],
    exclude: [/watch/, /ui\b/],
  },
  typecheck: {
    names: [/^type-?check$/, /(^|[:_-])type-?check([:_-]|$)/, /^tsc$/],
    cmds: [/tsc\s+--noemit/, /tsc\s+-p\b/, /tsc\s+--project/, /vue-tsc/, /\btsc\b/],
    exclude: [],
  },
  lint: {
    names: [/^lint$/, /(^|[:_-])lint([:_-]|$)/],
    cmds: [/\beslint\b/, /biome\s+(lint|check)/, /\bstylelint\b/],
    exclude: [/fix/],
  },
};

function isExcluded(name, scripts, def) {
  const cmd = (scripts[name] || '').toLowerCase();
  return (def.exclude || []).some((re) => re.test(name) || re.test(cmd));
}

function pickScript(names, scripts, def) {
  for (const re of def.names) {
    const hit = names.find((n) => re.test(n) && !isExcluded(n, scripts, def));
    if (hit) return hit;
  }
  for (const re of def.cmds) {
    const hit = names.find((n) => re.test((scripts[n] || '').toLowerCase()) && !isExcluded(n, scripts, def));
    if (hit) return hit;
  }
  return null;
}

export function classifyScripts(scripts = {}) {
  const safe = scripts || {};
  const names = Object.keys(safe);
  const out = {};
  for (const [cat, def] of Object.entries(CATEGORIES)) {
    out[cat] = pickScript(names, safe, def);
  }
  return out;
}

export function classifyRepo(root) {
  let pkg;
  try { pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')); }
  catch { return { build: null, test: null, typecheck: null, lint: null }; }
  return classifyScripts(pkg.scripts || {});
}

function main() {
  const root = process.argv[2] || process.cwd();
  process.stdout.write(JSON.stringify(classifyRepo(root), null, 2) + '\n');
}
if (import.meta.url === `file://${process.argv[1]}`) main();
