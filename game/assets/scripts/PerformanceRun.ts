export type FrameMode = 'active' | 'idle' | 'paused' | 'background';
export interface FrameSummary {
  frames: number; seconds: number; fps: number; p95: number; p99: number; longFrames: number; over100ms: number;
}

/** Opt-in whole-run observations. The caller keeps pauses and visibility changes explicit. */
export class PerformanceRun {
  readonly samples: [number, FrameMode, string][] = [];

  frame(dt: number, mode: FrameMode, district = 'legacy'): void {
    if (Number.isFinite(dt) && dt > 0) this.samples.push([dt * 1000, mode, district]);
  }

  summary(district?: string): Record<FrameMode, FrameSummary> {
    const result = {} as Record<FrameMode, FrameSummary>;
    for (const mode of ['active', 'idle', 'paused', 'background'] as const) {
      const values = this.samples.filter(sample => sample[1] === mode && (!district || sample[2] === district))
        .map(sample => sample[0]).sort((a, b) => a - b);
      const seconds = values.reduce((total, ms) => total + ms / 1000, 0);
      result[mode] = {
        frames: values.length, seconds, fps: seconds ? values.length / seconds : 0,
        p95: values[Math.max(0, Math.ceil(values.length * .95) - 1)] || 0,
        p99: values[Math.max(0, Math.ceil(values.length * .99) - 1)] || 0,
        longFrames: values.filter(ms => ms > 50).length,
        over100ms: values.filter(ms => ms > 100).length,
      };
    }
    return result;
  }
}
