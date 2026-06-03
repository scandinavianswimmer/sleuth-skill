#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = join(HERE, '..', 'schemas');

const typeOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);

export function validate(schema, value, path = '') {
  const errs = [];
  const at = path || 'root';
  if (schema.type && typeOf(value) !== schema.type) {
    errs.push(`${at}: expected ${schema.type}, got ${typeOf(value)}`);
    return errs;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errs.push(`${at}: '${value}' not in [${schema.enum.join(', ')}]`);
  }
  if (schema.type === 'object') {
    for (const req of schema.required || []) {
      if (!value || !(req in value)) errs.push(`${at}: missing required '${req}'`);
    }
    for (const [k, sub] of Object.entries(schema.properties || {})) {
      if (value && k in value) errs.push(...validate(sub, value[k], path ? `${path}.${k}` : k));
    }
  }
  if (schema.type === 'array' && schema.items) {
    (value || []).forEach((item, i) => errs.push(...validate(schema.items, item, `${at}[${i}]`)));
  }
  return errs;
}

export function loadSchema(kind) {
  return JSON.parse(readFileSync(join(SCHEMA_DIR, `${kind}.schema.json`), 'utf8'));
}

export function validateFile(kind, file) {
  return validate(loadSchema(kind), JSON.parse(readFileSync(file, 'utf8')));
}

export function initWorkspace(target) {
  const base = join(target, '.sleuth');
  for (const d of ['', 'personas', 'findings', 'runs']) mkdirSync(join(base, d), { recursive: true });
  const memPath = join(base, 'regression-memory.json');
  if (!existsSync(memPath)) writeFileSync(memPath, JSON.stringify({ findings: [], runs: [] }, null, 2) + '\n');
  return base;
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'init') {
    process.stdout.write(`initialized ${initWorkspace(rest[0] || process.cwd())}\n`);
  } else if (cmd === 'validate') {
    const [kind, file] = rest;
    const errs = validateFile(kind, file);
    if (errs.length) { process.stderr.write(errs.join('\n') + '\n'); process.exit(1); }
    process.stdout.write('valid\n');
  } else {
    process.stderr.write('usage: scaffold.mjs <init <dir> | validate <kind> <file>>\n');
    process.exit(2);
  }
}
if (import.meta.url === `file://${process.argv[1]}`) main();
