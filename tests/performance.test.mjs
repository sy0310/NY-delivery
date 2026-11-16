import test from 'node:test';
import assert from 'node:assert/strict';
import { PerformanceRun } from '../game/assets/scripts/PerformanceRun.ts';

test('whole-run frame statistics keep active, paused and background intervals separate', () => {
  const run=new PerformanceRun();
  for(let index=0;index<120;index++) run.frame(1/60,'active');
  run.frame(.12,'active');
  run.frame(2,'paused');
  run.frame(10,'background');
  const result=run.summary();
  assert.equal(result.active.frames,121);
  assert.ok(Math.abs(result.active.seconds-2.12)<.001);
  assert.equal(result.active.longFrames,1);
  assert.equal(result.active.p99,1000/60);
  assert.equal(result.paused.seconds,2);
  assert.equal(result.background.seconds,10);
  assert.equal(run.samples.length,123);
});
test('empty and invalid samples have deterministic finite summaries', () => {
  const run=new PerformanceRun();
  run.frame(NaN,'active'); run.frame(-1,'active'); run.frame(0,'active');
  assert.equal(run.summary().active.frames,0);
  assert.equal(run.summary().active.fps,0);
});
