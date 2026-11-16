import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('official survey-foot coordinates and roof heights convert to local metres with marked fallbacks',()=>{
  const output=execFileSync('python3',['-c',`
import sys,json
sys.path.insert(0,'scripts')
from district_data import local_point, roof_height, access_flags
print(json.dumps([local_point([1100,2200],[1000,2000],2263),roof_height(0),roof_height(None),roof_height(100),access_flags({'STATUS':'2','FROM_LEVEL_CODE':13,'TO_LEVEL_CODE':17,'TRAFDIR':'TW'},'flushing')]))
`],{encoding:'utf8'});
  const [point,zero,missing,height,bridge]=JSON.parse(output);
  assert.ok(Math.abs(point.x-30.48006096)<.00001);
  assert.ok(Math.abs(point.z+60.96012192)<.00001);
  assert.equal(zero.fallback,true);
  assert.equal(missing.fallback,true);
  assert.ok(zero.height>0);
  assert.ok(Math.abs(height.height-30.48)<.01);
  assert.equal(bridge,null);
});
test('large background buildings remain when their nearest footprint edge is close to the district',()=>{
 const output=execFileSync('python3',['-c',`
import sys
sys.path.insert(0,'scripts')
from district_data import polygon_distance
boundary=[{'x':0,'z':0},{'x':30,'z':0},{'x':30,'z':100},{'x':0,'z':100}]
building=[{'x':40,'z':0},{'x':1000,'z':0},{'x':1000,'z':100},{'x':40,'z':100}]
print(polygon_distance(building,boundary))
`],{encoding:'utf8'});
 assert.equal(Number(output),10);
});
