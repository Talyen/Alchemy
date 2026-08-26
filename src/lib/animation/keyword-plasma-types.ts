// Shared types for keyword plasma canvas and WebGL renderers.

export type PlasmaRendererMode = "canvas" | "webgl";

export interface PlasmaColorState {
  primary: string;
  secondary: string;
}

export interface PlasmaRendererOptions {
  canvas: HTMLCanvasElement;
  colorsRef: { current: PlasmaColorState };
  focalYOffset: number;
  active: () => boolean;
  onWakeReady?: (wake: () => void) => void;
}

export type StartPlasmaRenderer = (options: PlasmaRendererOptions) => () => void;

export const PLASMA_FRAME_MS = 1000 / 30;
export const PLASMA_MAX_BACKING_PIXELS = 1_500_000;
export const PLASMA_BACKING_SCALE = 0.45;
export const PLASMA_MIN_BACKING_SCALE = 0.25;
export const PLASMA_MAX_BACKING_SCALE = 0.75;
