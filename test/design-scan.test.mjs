import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanDesign, fontFamilies, distinctHexColors, zIndexMagic } from '../scripts/design-scan.mjs';

function w(root, rel, content) {
  const p = join(root, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, content);
}

test('fontFamilies extracts distinct primary families', () => {
  const fams = fontFamilies(`body{font-family:Inter, sans-serif} h1{font-family:"Poppins"}`);
  assert.deepEqual(fams.sort(), ['inter', 'poppins']);
});

test('distinctHexColors collects unique hex values', () => {
  assert.deepEqual(distinctHexColors('#FFF #ffffff #abcdef #abcdef').sort(), ['#abcdef', '#fff', '#ffffff']);
});

test('zIndexMagic flags >=100 css and tailwind values', () => {
  assert.deepEqual(zIndexMagic('z-index: 9999; .x{z-index:50} z-[1000]').sort((a,b)=>a-b), [1000, 9999]);
});

test('scanDesign reports the loud tells in a messy repo', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ds-'));
  w(tmp, 'a.css', `
    body{font-family:Inter} h1{font-family:Roboto} h2{font-family:Poppins} h3{font-family:Lato}
    .modal{z-index:9999 !important} .a{color:red !important} .b{backdrop-filter:blur(8px)}
    .hero{background:linear-gradient(90deg,#7c3aed,#a855f7)} .u{text-transform:uppercase}`);
  w(tmp, 'page.html', `<html><body><img src="x.png"><img src="y.png" alt="ok"></body></html>`);
  const s = scanDesign(tmp);
  assert.equal(s.fontFamilyCount, 4);
  assert.ok(s.zIndexMagic.includes(9999));
  assert.ok(s.importantCount >= 2);
  assert.ok(s.glassmorphism >= 1);
  assert.ok(s.aiPurpleGradient >= 1);
  assert.equal(s.missingAlt, 1);
  assert.equal(s.missingLang, true);
});

test('scanDesign stays quiet on a clean repo', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ds-'));
  w(tmp, 'clean.css', `body{font-family:Inter} .ok{color:#111827}`);
  w(tmp, 'ok.html', `<html lang="en"><body><img src="a.png" alt="a"></body></html>`);
  const s = scanDesign(tmp);
  assert.equal(s.fontFamilyCount, 1);
  assert.deepEqual(s.zIndexMagic, []);
  assert.equal(s.importantCount, 0);
  assert.equal(s.aiPurpleGradient, 0);
  assert.equal(s.missingAlt, 0);
  assert.equal(s.missingLang, false);
});
