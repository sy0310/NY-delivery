import test from 'node:test';
import assert from 'node:assert/strict';
import { audioPolicy } from '../game/assets/scripts/AudioPolicy.ts';

const input = { source:'radio', wantsPlayback:false, music:.55, environment:.2, effects:.45, contextState:null };

test('silent orders and external mode can initialize effects independently of BGM', () => {
  assert.deepEqual(audioPolicy(input), { channels:true, bgm:false, recovery:false });
  assert.deepEqual(audioPolicy({...input,source:'external',wantsPlayback:true}),
    {channels:true,bgm:false,recovery:false});
});
test('suspended or interrupted audio requests an explicit recovery while retaining pause intent', () => {
  assert.equal(audioPolicy({...input,contextState:'interrupted'}).recovery,true);
  assert.equal(audioPolicy({...input,contextState:'suspended',wantsPlayback:true}).bgm,true);
  assert.equal(audioPolicy({...input,contextState:'running'}).recovery,false);
  assert.equal(audioPolicy({...input,contextState:'suspended'}).bgm,false);
});
test('all-muted channels release the running audio graph and do not request recovery', () => {
  assert.deepEqual(audioPolicy({...input,music:0,environment:0,effects:0,wantsPlayback:true,contextState:'suspended'}),
    {channels:false,bgm:false,recovery:false});
  assert.equal(audioPolicy({...input,source:'external',environment:0,effects:0}).channels,false);
});
