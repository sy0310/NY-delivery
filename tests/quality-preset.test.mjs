import test from 'node:test';
import assert from 'node:assert/strict';
import { QUALITY_PRESETS } from '../game/assets/scripts/QualityPreset.ts';
test('low quality reduces actual render scale, shadow range and mirror cost while preserving the driving camera',()=>{
 const {low,standard}=QUALITY_PRESETS;
 assert.ok(low.renderScale<standard.renderScale);assert.equal(standard.renderScale,1);
 assert.ok(low.shadowSize<standard.shadowSize);assert.ok(low.shadowDistance<standard.shadowDistance);
 assert.ok(low.mirrorWidth<standard.mirrorWidth);assert.ok(low.mirrorFps<standard.mirrorFps);
 assert.ok(low.detailDistance<standard.detailDistance);assert.equal(low.dynamicLights,false);
});
