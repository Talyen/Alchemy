import {
  STARTUP_BAR_INCOMPLETE_CAP,
  STARTUP_BAR_TAU_MS,
  STARTUP_BAR_TRICKLE_PER_SEC,
  STARTUP_LOAD_BOOTSTRAP_WEIGHT,
  STARTUP_LOAD_FONT_WEIGHT,
  STARTUP_LOAD_IMAGE_WEIGHT,
} from "@/lib/game-constants";
import { clamp, clamp01 } from "@/lib/math";

const CAUGHT_UP_EPSILON = 0.002;
const MAX_FRAME_SECONDS = 0.1;

function computeStartupLoadTarget({
  imageLoaded,
  imageTotal,
  imagesSettled,
  fontsReady,
  bootstrapReady,
}: {
  imageLoaded: number;
  imageTotal: number;
  imagesSettled: boolean;
  fontsReady: boolean;
  bootstrapReady: boolean;
}): number {
  const imageFrac = imageTotal <= 0 ? 1 : clamp01(imageLoaded / imageTotal);
  const raw =
    STARTUP_LOAD_IMAGE_WEIGHT * imageFrac +
    STARTUP_LOAD_FONT_WEIGHT * (fontsReady ? 1 : 0) +
    STARTUP_LOAD_BOOTSTRAP_WEIGHT * (bootstrapReady ? 1 : 0);

  if (imagesSettled && fontsReady && bootstrapReady) return 1;
  return Math.min(STARTUP_BAR_INCOMPLETE_CAP, raw);
}

function advanceStartupBar(display: number, dtSeconds: number, target: number, complete: boolean): number {
  const dt = clamp(dtSeconds, 0, MAX_FRAME_SECONDS);
  const tau = STARTUP_BAR_TAU_MS / 1000;
  const chase = 1 - Math.exp(-dt / tau);
  let next = display + (target - display) * chase;

  if (!complete && target - next < CAUGHT_UP_EPSILON) {
    const room = STARTUP_BAR_INCOMPLETE_CAP - next;
    if (room > 0.001) {
      next += STARTUP_BAR_TRICKLE_PER_SEC * dt * (room / STARTUP_BAR_INCOMPLETE_CAP);
    }
    next = Math.min(next, STARTUP_BAR_INCOMPLETE_CAP);
  }

  next = Math.max(display, next);
  return Math.min(1, next);
}

import { STARTUP_BAR_REVEAL_THRESHOLD } from "@/lib/game-constants";

export interface StartupLoadState {
  readonly imageLoaded: number;
  readonly imageTotal: number;
  readonly imagesSettled: boolean;
  readonly fontsSettled: boolean;
  readonly bootstrapReady: boolean;
  readonly minimumElapsed: boolean;
  readonly display: number;
  readonly lastFrameMs: number | null;
  readonly ready: boolean;
}

export type StartupLoadEvent =
  | { type: "image-progress"; loaded: number; total: number }
  | { type: "images-settled" }
  | { type: "fonts-settled" }
  | { type: "bootstrap-ready"; ready: boolean }
  | { type: "minimum-elapsed" }
  | { type: "frame"; timestamp: number };

export function createStartupLoadState(imageTotal: number, bootstrapReady: boolean): StartupLoadState {
  return {
    imageLoaded: 0,
    imageTotal,
    imagesSettled: imageTotal === 0,
    fontsSettled: false,
    bootstrapReady,
    minimumElapsed: false,
    display: 0,
    lastFrameMs: null,
    ready: false,
  };
}

export function advanceStartupLoad(state: StartupLoadState, event: StartupLoadEvent): StartupLoadState {
  if (state.ready) return state;
  switch (event.type) {
    case "image-progress":
      return { ...state, imageLoaded: event.loaded, imageTotal: event.total };
    case "images-settled":
      return { ...state, imageLoaded: state.imageTotal, imagesSettled: true };
    case "fonts-settled":
      return { ...state, fontsSettled: true };
    case "bootstrap-ready":
      return { ...state, bootstrapReady: event.ready };
    case "minimum-elapsed":
      return { ...state, minimumElapsed: true };
    case "frame": {
      const complete = state.imagesSettled && state.fontsSettled && state.bootstrapReady;
      const target = computeStartupLoadTarget({
        imageLoaded: state.imageLoaded,
        imageTotal: state.imageTotal,
        imagesSettled: state.imagesSettled,
        fontsReady: state.fontsSettled,
        bootstrapReady: state.bootstrapReady,
      });
      const elapsedSeconds = state.lastFrameMs === null ? 0 : (event.timestamp - state.lastFrameMs) / 1000;
      const display = advanceStartupBar(state.display, elapsedSeconds, target, complete);
      return {
        ...state,
        display,
        lastFrameMs: event.timestamp,
        ready: complete && state.minimumElapsed && display >= STARTUP_BAR_REVEAL_THRESHOLD,
      };
    }
  }
}
