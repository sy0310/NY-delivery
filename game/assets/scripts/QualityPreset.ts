import type { CityPoint } from './DistrictDefinition';
import type { SceneView } from './DistrictPresentation';

// Project-local user layer 0. Keep the rear camera out of the car's own geometry.
export const VEHICLE_LAYER = 1 << 0;

/** Rendering budgets share one source for world visibility, shadows and the persistent mirror. */
export const QUALITY_PRESETS={
  standard:{renderScale:1,shadowSize:2048,shadowDistance:55,mirrorWidth:256,mirrorHeight:96,mirrorFps:30,blockDistance:340,detailDistance:170,dynamicLights:true},
  low:{renderScale:.7,shadowSize:1024,shadowDistance:30,mirrorWidth:128,mirrorHeight:48,mirrorFps:15,blockDistance:210,detailDistance:100,dynamicLights:false},
} as const;

export class CarDisplaySchedule {
  mode: 'driving'|'nearby'|'frozen' = 'frozen';
  mirror = false;
  panels = false;
  mirrorUpdates = 0;
  panelUpdates = 0;
  private mirrorElapsed = 0;
  private panelElapsed = 0;

  update(dt:number,view:SceneView,car:CityPoint,mirrorFps:number):void {
    const nearby = Math.hypot(view.position.x-car.x,view.position.z-car.z) <= 6;
    const mode = view.paused ? 'frozen' : view.inCar ? 'driving' : nearby ? 'nearby' : 'frozen';
    const changed = mode !== this.mode;
    this.mode = mode;
    this.mirror = this.panels = false;
    if (mode === 'frozen') {
      this.mirrorElapsed = this.panelElapsed = 0;
      return;
    }
    this.mirrorElapsed += dt;
    this.panelElapsed += dt;
    const mirrorInterval = mode === 'driving' ? 1/mirrorFps : .2;
    const panelInterval = mode === 'driving' ? .12 : .2;
    if (changed || this.mirrorElapsed + 1e-9 >= mirrorInterval) {
      this.mirror = true;
      this.mirrorElapsed = 0;
      this.mirrorUpdates++;
    }
    if (changed || this.panelElapsed >= panelInterval) {
      this.panels = true;
      this.panelElapsed = 0;
      this.panelUpdates++;
    }
  }
}
