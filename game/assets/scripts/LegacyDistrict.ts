import type { DistrictDefinition } from './DistrictDefinition';

const nodes = [{x:0,z:200},{x:0,z:-120},{x:0,z:-480},{x:350,z:-480},{x:350,z:-120},{x:350,z:200}];
const names = ['Orchard','Orchard','Canal','Mercer','Mercer','River','Juniper'];
const roads = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[1,4]].map(([a,b],index) => ({
  id:'legacy-'+index, name:names[index], from:String(a), to:String(b), points:[nodes[a],nodes[b]],
  width:13.6, direction:'FT' as const, car:true, foot:true,
}));
const parking = (x: number,z: number) => [{x:x-7,z:z-12},{x:x+7,z:z-12},{x:x+7,z:z+12},{x:x-7,z:z+12}];
export const LEGACY_RESTAURANT_ORIGIN={x:350,z:-85};

/** Compatibility district for the previously verified prototype and its existing callers. */
export const LEGACY_DISTRICT: DistrictDefinition = {
  id:'legacy', name:'Orchard prototype', borough:'Fictional', orderPrefix:'NY', units:'m',
  origin:{crs:'original local metres',coordinates:[0,0]},
  bounds:{minX:-40,minZ:-520,maxX:390,maxZ:240}, boundary:[], roads, buildings:[],
  restaurants:[{id:'juniper',name:'Juniper Kitchen',chineseName:'Juniper Kitchen',menu:'1 × Mushroom rice · 1 × Ginger tea',
    entry:{x:340,z:-85},counter:{x:335.7,z:-85},queue:{x:335,z:-84.8},parking:{x:344.5,z:-71},
    walkway:[{x:350,z:-85},{x:340,z:-85},{x:335.7,z:-85}],yaw:-90,width:12,depth:9}],
  deliveries:[[-360,'18 Orchard Walk'],[60,'42 Orchard Walk'],[-250,'76 Orchard Walk · Lobby']].map(([z,name],index)=>({
    id:'orchard-'+index,name:String(name),entry:{x:9.4,z:Number(z)},target:{x:9.4,z:Number(z)},
    parking:{x:5.5,z:Number(z)+10},walkway:[{x:0,z:Number(z)},{x:9.4,z:Number(z)}],yaw:90,kind:index===2?'lobby':'residence',
  })),
  parkingAreas:[parking(350,-71),parking(0,-350),parking(0,70),parking(0,-240)],
  spawn:{x:2.5,z:23,yaw:0},landmarks:[],sources:[],
};
