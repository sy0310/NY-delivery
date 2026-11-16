import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const report=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.deepEqual(report.toolbar,process.argv.includes('--music-shortcut')?['地图','音乐','菜单']:['地图','菜单']);
assert.equal(report.musicVisible,false);
assert.equal(report.phoneVisible,false);
assert.equal(report.navigationVisible,true);
assert.ok(!report.route.includes('路口按路线转弯'));
for(const button of report.buttons) {
  assert.ok(button.width>=44 && button.height>=44,button.id+' target');
  assert.ok(button.x>=0 && button.y>=0 && button.x+button.width<=report.width+1 && button.y+button.height<=report.height+1,button.id+' bounds');
}
for(let a=0;a<report.buttons.length;a++)for(let b=a+1;b<report.buttons.length;b++) {
  const first=report.buttons[a],second=report.buttons[b];
  const overlapX=Math.min(first.x+first.width,second.x+second.width)-Math.max(first.x,second.x);
  const overlapY=Math.min(first.y+first.height,second.y+second.height)-Math.max(first.y,second.y);
  assert.ok(overlapX<=0 || overlapY<=0,first.id+' overlaps '+second.id);
}
console.log('Actual driving UI passed — local navigation, collapsed panels and reachable controls');
