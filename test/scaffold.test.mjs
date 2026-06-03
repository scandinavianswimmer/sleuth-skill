import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validate, loadSchema, initWorkspace } from '../scripts/scaffold.mjs';

test('validate: valid persona passes', () => {
  const schema = loadSchema('persona');
  const ok = { id: 'p1', kind: 'icp', name: 'Dana', goal: 'book a class', techSavvy: 'low' };
  assert.deepEqual(validate(schema, ok), []);
});

test('validate: missing required field is reported', () => {
  const schema = loadSchema('persona');
  const errs = validate(schema, { id: 'p1', kind: 'icp', name: 'Dana' });
  assert.ok(errs.some(e => e.includes("missing required 'goal'")));
});

test('validate: wrong enum value is reported', () => {
  const schema = loadSchema('persona');
  const errs = validate(schema, { id: 'p1', kind: 'robot', name: 'X', goal: 'g', techSavvy: 'low' });
  assert.ok(errs.some(e => e.includes('not in [developer, icp]')));
});

test('validate: wrong type is reported', () => {
  const schema = loadSchema('finding');
  const errs = validate(schema, { id: 'f1', title: 't', type: 'bug', severity: 'low', repro: 'not-an-array', evidence: [] });
  assert.ok(errs.some(e => e.includes('repro') && e.includes('expected array')));
});

test('initWorkspace creates .sleuth tree + empty regression memory', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'sleuth-'));
  const base = initWorkspace(tmp);
  for (const d of ['personas', 'findings', 'runs']) assert.ok(existsSync(join(base, d)));
  const mem = JSON.parse(readFileSync(join(base, 'regression-memory.json'), 'utf8'));
  assert.deepEqual(mem, { findings: [], runs: [] });
});
