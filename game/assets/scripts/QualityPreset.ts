/** Rendering budgets share one source for world visibility, shadows and the persistent mirror. */
export const QUALITY_PRESETS={
  standard:{renderScale:1,shadowSize:2048,shadowDistance:55,mirrorWidth:256,mirrorHeight:96,mirrorFps:30,blockDistance:340,detailDistance:170,dynamicLights:true},
  low:{renderScale:.7,shadowSize:1024,shadowDistance:30,mirrorWidth:128,mirrorHeight:48,mirrorFps:15,blockDistance:210,detailDistance:100,dynamicLights:false},
} as const;
