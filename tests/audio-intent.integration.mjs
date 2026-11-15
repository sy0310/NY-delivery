import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Feed actual rendered UI evidence captured around an immediate user pause during source loading.
const evidence = JSON.parse(await readFile(process.argv[2],'utf8'));
assert.match(evidence.before.track,/播放中/);
assert.equal(evidence.after.source,'local');
assert.equal(evidence.after.recording,false);
assert.match(evidence.after.track,/已暂停/,'a pause issued during loading must remain paused after restoration');
const seconds = value => value.split(':').reduce((total,part) => total*60+Number(part),0);
assert.ok(Math.abs(seconds(evidence.after.time)-seconds(evidence.before.time))<=2,'return to the preserved local playback position');
console.log('Actual audio intent passed — local source and position restored with explicit pause');
