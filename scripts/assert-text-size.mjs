import assert from 'node:assert/strict';

import {
  MAX_COMBINED_SCALE,
  TEXT_SIZE_OPTIONS,
  migrateLegacyStoredTextSize,
  parseTextSize,
  scaleFontStyle,
  scaleForTextSize,
  systemFontCap,
} from '../lib/ui/text-scale.ts';

// Four options: new Small, Default (former Small), Large (former Default), Extra large (former Large).
assert.deepEqual(
  TEXT_SIZE_OPTIONS.map((o) => [o.key, o.scale]),
  [
    ['small', 0.8],
    ['default', 0.9],
    ['large', 1],
    ['xlarge', 1.2],
  ],
);
assert.equal(scaleForTextSize('xlarge'), 1.2);
assert.equal(scaleForTextSize('default'), 0.9);

// v1 stored keys map to v2 without changing on-screen size (except former Extra large → 1.2).
assert.equal(migrateLegacyStoredTextSize('small'), 'default');
assert.equal(migrateLegacyStoredTextSize('default'), 'large');
assert.equal(migrateLegacyStoredTextSize('large'), 'xlarge');
assert.equal(migrateLegacyStoredTextSize('xlarge'), 'xlarge');

// Bad or missing stored values fall back to Default (0.9).
assert.equal(parseTextSize(undefined), 'default');
assert.equal(parseTextSize(null), 'default');
assert.equal(parseTextSize('huge'), 'default');
assert.equal(parseTextSize('large'), 'large');

// Default scale returns the very same style object (no work, no new objects).
const base = { fontSize: 17, lineHeight: 24, fontWeight: '700' };
assert.equal(scaleFontStyle(base, 1), base);
assert.equal(scaleFontStyle(undefined, 1), undefined);

// Font size and line height both scale; other keys are kept; input not changed.
assert.deepEqual(scaleFontStyle(base, 1.2), {
  fontSize: 20.5,
  lineHeight: 29,
  fontWeight: '700',
});
assert.equal(base.fontSize, 17);
assert.deepEqual(scaleFontStyle({ fontSize: 17 }, 0.9), { fontSize: 15.5 });

// A Text with no font size is treated as React Native's default of 14.
assert.deepEqual(scaleFontStyle(undefined, 1.2), { fontSize: 17 });
assert.deepEqual(scaleFontStyle({ color: 'red' }, 1.2), {
  color: 'red',
  fontSize: 17,
});

// The phone's own font scale is capped so the two never exceed 1.6x together.
for (const { scale } of TEXT_SIZE_OPTIONS) {
  const cap = systemFontCap(scale);
  assert.ok(cap >= 1, `cap for ${scale} is at least 1`);
  assert.ok(
    cap * scale <= MAX_COMBINED_SCALE + 1e-9 || cap === 1,
    `combined scale for ${scale} stays within the limit`,
  );
}
assert.ok(Math.abs(systemFontCap(1.2) * 1.2 - 1.6) < 1e-9);
assert.equal(systemFontCap(2), 1);
assert.equal(systemFontCap(0), 1);

console.log('assert-text-size: ok');
