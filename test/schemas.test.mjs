import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'schemas');
const load = (k) => JSON.parse(readFileSync(join(DIR, `${k}.schema.json`), 'utf8'));

test('all schemas parse and are objects with required arrays', () => {
  for (const k of ['product-contract', 'persona', 'finding']) {
    const s = load(k);
    assert.equal(s.type, 'object');
    assert.ok(Array.isArray(s.required), `${k} has required[]`);
  }
});

test('persona schema constrains kind + techSavvy via enum', () => {
  const s = load('persona');
  assert.deepEqual(s.properties.kind.enum, ['developer', 'icp']);
  assert.deepEqual(s.properties.techSavvy.enum, ['low', 'medium', 'high']);
});

test('finding schema constrains type + severity via enum', () => {
  const s = load('finding');
  assert.deepEqual(s.properties.type.enum, ['bug', 'security', 'ux-friction', 'expected']);
  assert.deepEqual(s.properties.severity.enum, ['critical', 'high', 'medium', 'low', 'info']);
});
