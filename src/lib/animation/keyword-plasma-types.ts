import type { RgbTuple } from "./plasma-colors";

type PlasmaColorValue = string | RgbTuple;

export interface PlasmaColorState {
  primary: PlasmaColorValue;
  secondary: PlasmaColorValue;
}

export interface PlasmaRendererOptions {
  canvas: HTMLCanvasElement;
  colorsRef: { current: PlasmaColorState };
  focalYOffset: number;
  active: () => boolean;
  onAvailabilityChange?: ((available: boolean) => void) | undefined;
  onWakeReady?: ((wake: () => void) => void) | undefined;
}

export const PLASMA_MAX_BACKING_PIXELS = 1_500_000;
export const PLASMA_BACKING_SCALE = 0.45;
export const PLASMA_MIN_BACKING_SCALE = 0.25;
export const PLASMA_MAX_BACKING_SCALE = 0.75;
