import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('quality changes keep the mirror framebuffer alive and refresh its material binding', () => {
  const source = readFileSync(new URL('../game/assets/scripts/CarModel.ts', import.meta.url), 'utf8');
  const qualityMethod = source.slice(source.indexOf('setQuality('), source.indexOf('dispose():'));
  // Creator 3.8.8 reset destroys its framebuffer. Existing material bindings retain the dead GFX texture.
  assert.doesNotMatch(qualityMethod, /rearTexture\.reset\(/);
  assert.match(qualityMethod, /rearTexture\.resize\(preset\.mirrorWidth,\s*preset\.mirrorHeight\)/);
  assert.match(qualityMethod, /rearMaterial\.setProperty\('mainTexture',\s*this\.rearTexture\)/);
});
