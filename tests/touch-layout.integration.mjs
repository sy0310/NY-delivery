import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const {width,height,buttons} = JSON.parse(await readFile(process.argv[2],'utf8'));
assert.ok(buttons.length>=8,'capture the actual active touch-driving layout');
for (const button of buttons) {
  assert.ok(button.width>=44 && button.height>=44,button.id+' has a touch-sized target');
  assert.ok(button.x>=0 && button.y>=0 && button.x+button.width<=width+1 && button.y+button.height<=height+1,button.id+' stays in the viewport');
}
for (let a=0;a<buttons.length;a++) for (let b=a+1;b<buttons.length;b++) {
  const first=buttons[a], second=buttons[b];
  const overlapX=Math.min(first.x+first.width,second.x+second.width)-Math.max(first.x,second.x);
  const overlapY=Math.min(first.y+first.height,second.y+second.height)-Math.max(first.y,second.y);
  assert.ok(overlapX<=0 || overlapY<=0,first.id+' overlaps '+second.id);
}
console.log('Actual touch layout passed — minimum targets, viewport bounds and no button overlap');
