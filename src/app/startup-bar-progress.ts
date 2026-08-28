import {
  STARTUP_BAR_INCOMPLETE_CAP,
  STARTUP_BAR_TAU_MS,
  STARTUP_BAR_TRICKLE_PER_SEC,
  STARTUP_LOAD_BOOTSTRAP_WEIGHT,
  STARTUP_LOAD_FONT_WEIGHT,
  STARTUP_LOAD_IMAGE_WEIGHT,
} from "@/lib/game-constants";

const CAUGHT_UP_EPSILON = 0.002;
const MAX_FRAME_SECONDS = 0.1;

export function computeStartupLoadTarget({
  imageLoaded,
  imageTotal,
  fontsReady,
  bootstrapReady,
}: {
  imageLoaded: number;
  imageTotal: number;
  fontsReady: boolean;
  bootstrapReady: boolean;
}): number {
  const imagesDone = imageTotal <= 0 || imageLoaded >= imageTotal;
  const imageFrac = imageTotal <= 0 ? 1 : Math.min(1, Math.max(0, imageLoaded / imageTotal));
  const raw =
    STARTUP_LOAD_IMAGE_WEIGHT * imageFrac +
    STARTUP_LOAD_FONT_WEIGHT * (fontsReady ? 1 : 0) +
    STARTUP_LOAD_BOOTSTRAP_WEIGHT * (bootstrapReady ? 1 : 0);

  if (imagesDone && fontsReady && bootstrapReady) return 1;
  return Math.min(STARTUP_BAR_INCOMPLETE_CAP, raw);
}

export function advanceStartupBar(display: number, dtSeconds: number, target: number, complete: boolean): number {
  const dt = Math.min(MAX_FRAME_SECONDS, Math.max(0, dtSeconds));
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
