/** Internal motion-lab seam. Not exported by the package; defaults remain unchanged. */
export interface MotionExperiment {
  widthDuration: number;
  entryDuration: number;
  entryHold: number;
  entryDistance: number;
  fadeDuration: number;
  /** 0: retained insertion edge; 1: final position. */
  entryOrigin: number;
}

export const motionExperiments = new WeakMap<HTMLElement, MotionExperiment>();
