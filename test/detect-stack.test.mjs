import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectStack, detectFramework, detectExpressRoutes, detectForms, detectAuth } from '../scripts/detect-stack.mjs';

function w(root, rel, content) {
  const p = join(root, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, content);
}

test('detectFramework reads dependencies', () => {
  assert.equal(detectFramework({ dependencies: { next: '14' } }), 'next');
  assert.equal(detectFramework({ dependencies: { express: '4' } }), 'express');
  assert.equal(detectFramework({}), 'unknown');
});

test('detectExpressRoutes finds method + path', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ds-'));
  w(tmp, 'server.js', `app.get('/admin', h); router.post("/login", h);`);
  const routes = detectExpressRoutes([join(tmp, 'server.js')]);
  assert.deepEqual(routes.sort((a, b) => a.path.localeCompare(b.path)), [
    { method: 'GET', path: '/admin' },
    { method: 'POST', path: '/login' },
  ]);
});

test('detectForms extracts input names from files containing <form>', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ds-'));
  w(tmp, 'Login.jsx', `<form><input name="email"/><input name="password"/></form>`);
  const forms = detectForms([join(tmp, 'Login.jsx')]);
  assert.equal(forms.length, 1);
  assert.deepEqual(forms[0].fields.sort(), ['email', 'password']);
});

test('detectAuth surfaces known auth hints', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ds-'));
  w(tmp, 'auth.js', `import jwt from 'jsonwebtoken'; jwt.sign(x); req.session.user = 1;`);
  const hints = detectAuth([join(tmp, 'auth.js')]).sort();
  assert.deepEqual(hints, ['jwt', 'session']);
});

test('detectStack on a Next app reports framework + routes + env', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ds-'));
  w(tmp, 'package.json', JSON.stringify({ name: 'demo', dependencies: { next: '14' }, scripts: { dev: 'next dev' } }));
  w(tmp, 'app/page.tsx', 'export default function P(){return null}');
  w(tmp, 'app/admin/page.tsx', 'export default function A(){return null}');
  w(tmp, '.env.example', 'DATABASE_URL=\nSTRIPE_KEY=\n');
  const s = detectStack(tmp);
  assert.equal(s.framework, 'next');
  assert.deepEqual(s.routes.sort(), ['/', '/admin']);
  assert.deepEqual(s.env.sort(), ['DATABASE_URL', 'STRIPE_KEY']);
  assert.equal(s.entrypoints.dev, 'next dev');
});
