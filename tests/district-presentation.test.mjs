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

// Creator 3.8.8 quad vertices are BL, TL, TR, BR. A row-major UV overwrite twists both triangles.
test('atlas panels retain Creator quad vertex-to-UV correspondence for every cell',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {stripTypeScriptTypes}=await import('node:module');
 const source=await readFile(new URL('../game/assets/scripts/ModelGeometry.ts',import.meta.url),'utf8');
 const method=source.slice(source.indexOf('  atlasPanel('),source.indexOf('  material('));
 const geometry={uvs:[0,0,0,1,1,1,1,0]};
 const Panel=Function('primitives','utils','MeshRenderer',stripTypeScriptTypes(`class Panel { panels=new Map(); mesh(k,g,m,p){return {geometry:g,setScale(){},getComponent(){return {}}};} ${method} }`)+"; return Panel;" )(
  {quad:()=>({...geometry,uvs:[...geometry.uvs]})},{createMesh:g=>g},{ShadowCastingMode:{OFF:0}});
 const panels=new Panel();
 for(let cell=0;cell<16;cell++){
  const panel=panels.atlasPanel('cell-'+cell,2,1,{},cell,{});
  assert.deepEqual(panel.geometry.uvs,[cell%4/4,Math.floor(cell/4)/4,cell%4/4,(Math.floor(cell/4)+1)/4,(cell%4+1)/4,(Math.floor(cell/4)+1)/4,(cell%4+1)/4,Math.floor(cell/4)/4]);
 }
});
