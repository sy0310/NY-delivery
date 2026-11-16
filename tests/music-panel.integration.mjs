import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const report=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.equal(report.paused,true,'opening music from the pause menu preserves pause');
assert.equal(report.tabs,3,'music has three direct source tabs');
assert.equal(report.externalPrimary,true,'external mode has an actionable handoff');
if(report.bodyOverflow!==undefined)assert.ok(report.bodyOverflow<=1,'the source view fits without horizontal scrolling');
if(report.source==='external') {
  assert.equal(report.playVisible,false,'external playback stays in the external app');
  assert.equal(report.previousVisible,false);
  assert.equal(report.nextVisible,false);
}
console.log('Actual music panel passed — pause preserved, three sources and explicit external handoff');
