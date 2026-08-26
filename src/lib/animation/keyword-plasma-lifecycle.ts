// Shared resize, pause, and 30fps scheduling for keyword plasma renderers.
import { isAnimationDisabled } from "./animation-prefs";
import {
  PLASMA_FRAME_MS,
  PLASMA_BACKING_SCALE,
  PLASMA_MAX_BACKING_PIXELS,
  PLASMA_MIN_BACKING_SCALE,
  PLASMA_MAX_BACKING_SCALE,
} from "./keyword-plasma-types";

export function resolvePlasmaBackingScale(width: number, height: number): number {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const requested = (devicePixelRatio || 1) * PLASMA_BACKING_SCALE;
  const pixelLimited = Math.sqrt(PLASMA_MAX_BACKING_PIXELS / (safeWidth * safeHeight));
  return Math.min(Math.max(requested, PLASMA_MIN_BACKING_SCALE), PLASMA_MAX_BACKING_SCALE, pixelLimited);
}

export interface PlasmaLifecycle {
  logicalWidth: number;
  logicalHeight: number;
  scheduleFrame: () => void;
  dispose: () => void;
}

export function createPlasmaLifecycle({
  canvas,
  active,
  onFrame,
}: {
  canvas: HTMLCanvasElement;
  active: () => boolean;
  onFrame: (now: number, width: number, height: number) => void;
}): PlasmaLifecycle {
  const parent = canvas.parentElement;
  if (!parent) {
    return { logicalWidth: 0, logicalHeight: 0, scheduleFrame: () => {}, dispose: () => {} };
  }
  const activeParent = parent;

  let running = true;
  let animFrameId: number | null = null;
  let lastFrameAt = 0;
  const startTime = performance.now();

  const lifecycle: PlasmaLifecycle = {
    logicalWidth: 0,
    logicalHeight: 0,
    scheduleFrame: () => {},
    dispose: () => {},
  };

  function resize() {
    const w = activeParent.clientWidth;
    const h = activeParent.clientHeight;
    const cssWidth = `${w}px`;
    const cssHeight = `${h}px`;
    if (canvas.style.width !== cssWidth) canvas.style.width = cssWidth;
    if (canvas.style.height !== cssHeight) canvas.style.height = cssHeight;
    if (w <= 0 || h <= 0) {
      canvas.width = 1;
      canvas.height = 1;
      lifecycle.logicalWidth = 0;
      lifecycle.logicalHeight = 0;
      return;
    }

    const backingScale = resolvePlasmaBackingScale(w, h);
    const backingWidth = Math.max(1, Math.floor(w * backingScale));
    const backingHeight = Math.max(1, Math.floor(h * backingScale));
    if (canvas.width !== backingWidth) canvas.width = backingWidth;
    if (canvas.height !== backingHeight) canvas.height = backingHeight;
    lifecycle.logicalWidth = w;
    lifecycle.logicalHeight = h;
    scheduleFrame();
  }

  function isPaused() {
    return (
      !running ||
      !active() ||
      isAnimationDisabled() ||
      document.hidden ||
      !document.hasFocus() ||
      canvas.width < 2 ||
      canvas.height < 2
    );
  }

  function scheduleFrame() {
    if (isPaused() || animFrameId !== null) return;
    animFrameId = requestAnimationFrame(frame);
  }

  function frame(now: number) {
    animFrameId = null;
    if (isPaused()) {
      lastFrameAt = now;
      return;
    }

    if (now - lastFrameAt < PLASMA_FRAME_MS) {
      scheduleFrame();
      return;
    }
    lastFrameAt = now;

    const elapsed = (now - startTime) / 1000;
    onFrame(elapsed, lifecycle.logicalWidth, lifecycle.logicalHeight);
    scheduleFrame();
  }

  function resume() {
    if (!running || animFrameId !== null) return;
    lastFrameAt = 0;
    scheduleFrame();
  }

  function handleVisibilityChange() {
    if (!document.hidden && running) resume();
  }

  function handleWindowBlur() {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(activeParent);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("blur", handleWindowBlur);
  window.addEventListener("focus", resume);
  scheduleFrame();

  lifecycle.scheduleFrame = scheduleFrame;
  lifecycle.dispose = () => {
    running = false;
    if (animFrameId !== null) cancelAnimationFrame(animFrameId);
    ro.disconnect();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("blur", handleWindowBlur);
    window.removeEventListener("focus", resume);
  };

  return lifecycle;
}
