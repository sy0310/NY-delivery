import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FLUSHING_DISTRICT } from '../game/assets/scripts/FlushingDistrict.ts';
import { CHINATOWN_DISTRICT } from '../game/assets/scripts/ChinatownDistrict.ts';

const report=JSON.parse(await readFile(process.argv[2],'utf8'));
const observation = name => {
  const item=report.observations.find(item=>item.case===name);
  assert.ok(item,`Missing actual observation ${name}`);
  return item;
};
for(const [district,doorIndex]of[[FLUSHING_DISTRICT,0],[CHINATOWN_DISTRICT,2]]) {
  for(const quality of ['low','standard']) {
    for(const place of ['counter','door']) {
      const item=observation(`${district.id}-far-${place}-${quality}`);
      const pose=item.hud.match(/x ([\d.-]+)  z ([\d.-]+)/);
      const point={x:Number(pose[1]),z:Number(pose[2])};
      const target=place==='counter'?district.restaurants[0].counter:district.deliveries[doorIndex].target;
      assert.ok(Math.hypot(point.x-target.x,point.z-target.z)<5);
      assert.ok(Math.hypot(point.x-item.car.x,point.z-item.car.z)>170);
      assert.ok(item.hud.includes('Car displays frozen · mirror 0'));
    }
  }
  assert.ok(observation(`${district.id}-return-near-car`).hud.includes('Car displays nearby'));
  assert.ok(observation(`${district.id}-return-entered`).hud.includes('Car displays driving'));
}
const muted=observation('browser-mute-all').hud;
assert.ok(muted.includes('Context suspended · music 0 environment 0 effects 0'));
assert.ok(muted.includes('Single player · paused'));
const effects=observation('browser-effects-only-recovered').hud;
assert.ok(effects.includes('Context running · music 0 environment 0 effects 0.3'));
assert.ok(effects.includes('Single player · paused'));
assert.ok(observation('flushing-order-complete').summary.includes('$9.75'));
assert.ok(observation('chinatown-order-complete').summary.includes('$20.00'));
console.log('Actual review observations passed — both districts and qualities, distant close-ups, return, audio recovery and two deliveries');
