import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint, record, plan, diff } from '../scripts/regression.mjs';

const f = (over = {}) => ({ title: 'Unprotected /admin', type: 'security', route: '/admin', severity: 'critical', ...over });

test('fingerprint is stable for same identity, differs on route', () => {
  assert.equal(fingerprint(f()), fingerprint(f()));
  assert.notEqual(fingerprint(f()), fingerprint(f({ route: '/dashboard' })));
});

test('record adds new findings as open and logs the run', () => {
  const mem = record({ findings: [], runs: [] }, 'run1', [f()]);
  assert.equal(mem.findings.length, 1);
  assert.equal(mem.findings[0].status, 'open');
  assert.equal(mem.runs[0].id, 'run1');
});

test('plan returns open + regressed findings', () => {
  const mem = record({ findings: [], runs: [] }, 'run1', [f()]);
  assert.equal(plan(mem).length, 1);
});

test('diff flips a previously-open finding to resolved when absent', () => {
  const mem = record({ findings: [], runs: [] }, 'run1', [f()]);
  const after = diff(mem, 'run2', []); // re-run finds nothing → fixed
  assert.equal(after.findings[0].status, 'resolved');
});

test('diff marks a resolved finding regressed if it reappears', () => {
  let mem = record({ findings: [], runs: [] }, 'run1', [f()]);
  mem = diff(mem, 'run2', []);              // resolved
  mem = diff(mem, 'run3', [f()]);           // came back
  assert.equal(mem.findings[0].status, 'regressed');
});
