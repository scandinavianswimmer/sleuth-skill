#!/usr/bin/env node
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.sleuth', 'coverage', '.turbo']);
const CODE_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

export function walk(root, exts = CODE_EXTS) {
  const out = [];
  (function rec(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (IGNORE.has(e.name) || e.name.startsWith('.')) continue;
        rec(full);
      } else if (exts.some((x) => e.name.endsWith(x))) {
        out.push(full);
      }
    }
  })(root);
  return out;
}

export function readJSON(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

export function detectFramework(pkg) {
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  if (deps.next) return 'next';
  if (deps.vite) return 'vite';
  if (deps.express) return 'express';
  if (deps.react) return 'react';
  return 'unknown';
}

export function detectNextRoutes(root) {
  const routes = [];
  for (const base of ['app', 'src/app']) {
    const dir = join(root, base);
    if (!existsSync(dir)) continue;
    for (const f of walk(dir, ['.tsx', '.jsx', '.ts', '.js'])) {
      if (!/[\\/]page\.(t|j)sx?$/.test(f)) continue;
      let r = '/' + relative(dir, f).split(sep).slice(0, -1).join('/');
      r = r.replace(/\/\([^)]*\)/g, '');
      r = r.replace(/\/$/, '') || '/';
      routes.push(r);
    }
  }
  for (const base of ['pages', 'src/pages']) {
    const dir = join(root, base);
    if (!existsSync(dir)) continue;
    for (const f of walk(dir, ['.tsx', '.jsx', '.ts', '.js'])) {
      const rel = relative(dir, f);
      if (rel.startsWith('api' + sep) || /_app|_document/.test(rel)) continue;
      let r = '/' + rel.replace(/\.(t|j)sx?$/, '').replace(/\/index$/, '');
      r = r === '/' || r === '' ? '/' : r;
      routes.push(r);
    }
  }
  return [...new Set(routes)];
}

export function detectExpressRoutes(files) {
  const routes = [];
  for (const f of files) {
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    const re = /\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let m;
    while ((m = re.exec(src))) routes.push({ method: m[1].toUpperCase(), path: m[2] });
  }
  return routes;
}

export function detectForms(files) {
  const forms = [];
  const inputRe = /name\s*=\s*['"]([^'"]+)['"]/g;
  for (const f of files) {
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    if (!/<form/i.test(src)) continue;
    const names = new Set();
    let m;
    while ((m = inputRe.exec(src))) names.add(m[1]);
    if (names.size) forms.push({ file: f, fields: [...names] });
  }
  return forms;
}

export function detectAuth(files) {
  const hints = new Set();
  const kw = {
    'next-auth': /next-auth/i,
    jwt: /jsonwebtoken|jwt\.sign|jwt\.verify/i,
    passport: /passport/i,
    session: /express-session|req\.session/i,
    bcrypt: /bcrypt/i,
    cookie: /set-cookie|cookies\(\)/i,
  };
  for (const f of files) {
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    for (const [k, re] of Object.entries(kw)) if (re.test(src)) hints.add(k);
  }
  return [...hints];
}

export function detectEnv(root, files) {
  const vars = new Set();
  for (const name of ['.env', '.env.example', '.env.local']) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=/);
      if (m) vars.add(m[1]);
    }
  }
  for (const f of files) {
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    const re = /process\.env\.([A-Z0-9_]+)/g;
    let m;
    while ((m = re.exec(src))) vars.add(m[1]);
  }
  return [...vars];
}

export function detectStack(root) {
  const pkg = readJSON(join(root, 'package.json'));
  const files = walk(root);
  const framework = detectFramework(pkg);
  return {
    name: pkg?.name || null,
    framework,
    scripts: pkg?.scripts || {},
    entrypoints: { main: pkg?.main || null, dev: pkg?.scripts?.dev || null, start: pkg?.scripts?.start || null },
    routes: framework === 'next' ? detectNextRoutes(root) : [],
    apiRoutes: detectExpressRoutes(files),
    forms: detectForms(files),
    auth: detectAuth(files),
    env: detectEnv(root, files),
    fileCount: files.length,
  };
}

function main() {
  const root = process.argv[2] || process.cwd();
  process.stdout.write(JSON.stringify(detectStack(root), null, 2) + '\n');
}
if (import.meta.url === `file://${process.argv[1]}`) main();
