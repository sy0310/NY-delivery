import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const bundle = new URL('../game/build/web-desktop/assets/main/index.js', import.meta.url);
test('Creator output retains iterable conversion for route progress and Blob URL ownership', {skip:!existsSync(bundle)}, () => {
  const output = readFileSync(bundle,'utf8');
  // Creator 3.8.8 uses loose array-spread compilation. Direct TS tests cannot catch this.
  assert.match(output,/Array\.from\(pending\)\.sort/);
  assert.match(output,/Array\.from\(new Set\(this\.local\.map/);
  assert.doesNotMatch(output,/\[\]\.concat\(pending\)/);
  assert.doesNotMatch(output,/\[\]\.concat\(new Set/);
});
