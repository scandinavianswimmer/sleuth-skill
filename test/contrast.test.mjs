import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseColor, ratio, verdict, relativeLuminance } from '../scripts/contrast.mjs';

test('parseColor handles #rgb, #rrggbb, rgb(), rgba()', () => {
  assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseColor('#000000'), { r: 0, g: 0, b: 0 });
  assert.deepEqual(parseColor('rgb(10, 20, 30)'), { r: 10, g: 20, b: 30 });
  assert.deepEqual(parseColor('rgba(10,20,30,0.5)'), { r: 10, g: 20, b: 30 });
  assert.equal(parseColor('not-a-color'), null);
});

test('ratio: black on white is 21:1', () => {
  assert.ok(Math.abs(ratio('#000000', '#ffffff') - 21) < 0.01);
});

test('ratio: identical colors is 1:1', () => {
  assert.ok(Math.abs(ratio('#777777', '#777777') - 1) < 0.001);
});

test('ratio: muted gray on near-white fails AA (the classic AI tell)', () => {
  const r = ratio('#9CA3AF', '#F9FAFB');
  assert.ok(r < 4.5, `expected <4.5 got ${r}`);
});

test('verdict: thresholds for normal and large text', () => {
  assert.deepEqual(verdict(4.5, { large: false }), { ratio: 4.5, large: false, aa: true, aaa: false });
  assert.equal(verdict(4.49, {}).aa, false);
  assert.equal(verdict(3.0, { large: true }).aa, true);
  assert.equal(verdict(7.0, {}).aaa, true);
  assert.equal(verdict(4.5, { large: true }).aaa, true);
});

test('relativeLuminance: white is 1.0, black is 0.0', () => {
  assert.ok(Math.abs(relativeLuminance('#ffffff') - 1) < 1e-9);
  assert.ok(Math.abs(relativeLuminance('#000000') - 0) < 1e-9);
  assert.equal(relativeLuminance('garbage'), null);
});
