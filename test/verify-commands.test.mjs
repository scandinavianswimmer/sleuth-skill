import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyScripts } from '../scripts/verify-commands.mjs';

test('classifies standard build/test/typecheck/lint by name', () => {
  assert.deepEqual(
    classifyScripts({ build: 'next build', test: 'vitest run', typecheck: 'tsc --noEmit', lint: 'eslint .' }),
    { build: 'build', test: 'test', typecheck: 'typecheck', lint: 'lint' },
  );
});

test('classifies by command content when names are nonstandard', () => {
  assert.deepEqual(
    classifyScripts({ compile: 'tsc --noEmit', check: 'eslint src', spec: 'jest' }),
    { build: null, test: 'spec', typecheck: 'compile', lint: 'check' },
  );
});

test('only a test script → others null', () => {
  assert.deepEqual(
    classifyScripts({ test: 'node --test' }),
    { build: null, test: 'test', typecheck: null, lint: null },
  );
});

test('does not pick watch or auto-fix variants', () => {
  const r = classifyScripts({ 'test:watch': 'vitest', 'lint:fix': 'eslint . --fix' });
  assert.equal(r.test, null);
  assert.equal(r.lint, null);
});

test('empty / missing scripts → all null', () => {
  assert.deepEqual(classifyScripts({}), { build: null, test: null, typecheck: null, lint: null });
  assert.deepEqual(classifyScripts(), { build: null, test: null, typecheck: null, lint: null });
});
