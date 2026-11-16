import test from 'node:test';
import assert from 'node:assert/strict';
import { roadSegments, placePose, distanceToBounds } from '../game/assets/scripts/DistrictPresentation.ts';
test('slanted real street segments retain metre lengths and renderer headings',()=>{
 const [segment]=roadSegments([{x:4,z:2},{x:7,z:6}]);
 assert.equal(segment.length,5);assert.deepEqual(segment.center,{x:5.5,z:4});
 assert.ok(Math.abs(Math.sin(segment.yaw*Math.PI/180)*5-3)<1e-9);
});
test('shop-local detail follows the source frontage and block distance includes its entire bounds',()=>{
 const pose=placePose({entry:{x:10,z:20},yaw:90},2,4);
 assert.ok(Math.abs(pose.x-14)<1e-9);assert.ok(Math.abs(pose.z-18)<1e-9);
 assert.equal(distanceToBounds({x:4,z:4},{minX:0,maxX:10,minZ:0,maxZ:10}),0);
 assert.equal(distanceToBounds({x:13,z:14},{minX:0,maxX:10,minZ:0,maxZ:10}),5);
});

// Creator 3.8.8 orders quad vertices BL, TL, TR, BR.
// The atlas canvas is vertically flipped before Cocos uploads it.
test('atlas panels retain Creator quad vertex-to-UV correspondence for every cell', async () => {
  const { readFile } = await import('node:fs/promises');
  const { stripTypeScriptTypes } = await import('node:module');
  const source = await readFile(new URL('../game/assets/scripts/ModelGeometry.ts', import.meta.url), 'utf8');
  const method = source.slice(source.indexOf('  atlasPanel('), source.indexOf('  material('));
  const panelClass = stripTypeScriptTypes(`
    class Panels {
      panels = new Map();
      mesh(key, geometry, material, parent) {
        return { geometry, setScale() {}, getComponent() { return {}; } };
      }
      ${method}
    }
  `);
  const createPanels = Function('primitives', 'utils', 'MeshRenderer', panelClass + '; return Panels;');
  const Panels = createPanels(
    { quad: () => ({ uvs: [0, 0, 0, 1, 1, 1, 1, 0] }) },
    { createMesh: geometry => geometry },
    { ShadowCastingMode: { OFF: 0 } },
  );
  const panels = new Panels();
  for (let cell = 0; cell < 16; cell++) {
    const panel = panels.atlasPanel('cell-' + cell, 2, 1, {}, cell, {});
    const left = cell % 4 / 4;
    const bottom = (3 - Math.floor(cell / 4)) / 4;
    assert.deepEqual(panel.geometry.uvs, [
      left, bottom,
      left, bottom + .25,
      left + .25, bottom + .25,
      left + .25, bottom,
    ]);
  }
});
