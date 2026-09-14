import { createCanvasLifecycle, resolveCanvasBackingScale, type CanvasLifecycle } from "./canvas-lifecycle";
import {
  PLASMA_BACKING_SCALE,
  PLASMA_MAX_BACKING_PIXELS,
  PLASMA_MIN_BACKING_SCALE,
  PLASMA_MAX_BACKING_SCALE,
} from "./keyword-plasma-types";

export function resolvePlasmaBackingScale(width: number, height: number): number {
  return resolveCanvasBackingScale(width, height, {
    scaleMultiplier: PLASMA_BACKING_SCALE,
    minScale: PLASMA_MIN_BACKING_SCALE,
    maxScale: PLASMA_MAX_BACKING_SCALE,
    maxPixels: PLASMA_MAX_BACKING_PIXELS,
  });
}

export type PlasmaLifecycle = CanvasLifecycle;

export function createPlasmaLifecycle({
  canvas,
  active,
  onFrame,
}: {
  canvas: HTMLCanvasElement;
  active: () => boolean;
  onFrame: (now: number, width: number, height: number) => void;
}): PlasmaLifecycle {
  const startTime = performance.now();

  return createCanvasLifecycle({
    canvas,
    active,
    fpsLimit: 30,
    backingScale: {
      scaleMultiplier: PLASMA_BACKING_SCALE,
      minScale: PLASMA_MIN_BACKING_SCALE,
      maxScale: PLASMA_MAX_BACKING_SCALE,
      maxPixels: PLASMA_MAX_BACKING_PIXELS,
    },
    onFrame: (now, _dt, width, height) => {
      const elapsed = (now - startTime) / 1000;
      onFrame(elapsed, width, height);
    },
  });
}
