import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { phone, music, action, width, height } = JSON.parse(await readFile(process.argv[2], 'utf8'));
if (phone.visible && music.visible) {
  const overlapX = Math.min(phone.x + phone.width, music.x + music.width) - Math.max(phone.x, music.x);
  const overlapY = Math.min(phone.y + phone.height, music.y + music.height) - Math.max(phone.y, music.y);
  assert.ok(overlapX <= 0 || overlapY <= 0, 'Order and music panels overlap');
}
if (phone.visible) {
  assert.ok(action.visible && action.width >= 44 && action.height >= 44);
  assert.ok(action.x >= 0 && action.y >= 0 && action.x + action.width <= width && action.y + action.height <= height);
}
console.log('Actual phone panels passed — readable panels and an accessible order action');
