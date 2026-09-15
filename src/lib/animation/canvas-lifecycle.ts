import { clamp } from "@/lib/math";
import { shouldReduceMotion } from "./animation-prefs";

export interface CanvasBackingScaleOptions {
  scaleMultiplier?: number;
  minScale?: number;
  maxScale?: number;
  maxPixels?: number;
}

export function resolveCanvasBackingScale(
  width: number,
  height: number,
  options: CanvasBackingScaleOptions = {},
): number {
  const { scaleMultiplier = 1, minScale = 0.25, maxScale = 2.0, maxPixels = 3_000_000 } = options;
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const dpr = typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1;
  const requested = (dpr || 1) * scaleMultiplier;
  const pixelLimited = Math.sqrt(maxPixels / (safeWidth * safeHeight));
  return Math.min(clamp(requested, minScale, maxScale), pixelLimited);
}

export interface CanvasLifecycleOptions {
  canvas: HTMLCanvasElement;
  active?: () => boolean;
  backingScale?: CanvasBackingScaleOptions;
  fpsLimit?: number;
  pauseOnBlur?: boolean;
  immediate?: boolean;
  onResize?: (width: number, height: number, backingScale: number) => void;
  onFrame: (now: number, dt: number, width: number, height: number) => void;
}

export interface CanvasLifecycle {
  logicalWidth: number;
  logicalHeight: number;
  scheduleFrame: () => void;
  dispose: () => void;
}

export function createCanvasLifecycle({
  canvas,
  active = () => true,
  backingScale: backingScaleOptions,
  fpsLimit,
  pauseOnBlur = true,
  immediate = false,
  onResize,
  onFrame,
}: CanvasLifecycleOptions): CanvasLifecycle {
  const parent = canvas.parentElement;
  if (!parent) {
    return { logicalWidth: 0, logicalHeight: 0, scheduleFrame: () => {}, dispose: () => {} };
  }
  const activeParent = parent;

  let running = true;
  let animFrameId: number | null = null;
  let lastTime = performance.now();
  let lastFrameAt = 0;
  const minFrameIntervalMs = fpsLimit && fpsLimit > 0 ? 1000 / fpsLimit : 0;

  const lifecycle: CanvasLifecycle = {
    logicalWidth: 0,
    logicalHeight: 0,
    scheduleFrame: () => {},
    dispose: () => {},
  };

  let ro: ResizeObserver | null = null;
  let lastDpr = typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1;
  let lastBackingWidth = -1;
  let lastBackingHeight = -1;

  function resize() {
    lastDpr = typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1;
    const w = activeParent.clientWidth;
    const h = activeParent.clientHeight;
    const cssWidth = `${w}px`;
    const cssHeight = `${h}px`;
    if (canvas.style.width !== cssWidth) canvas.style.width = cssWidth;
    if (canvas.style.height !== cssHeight) canvas.style.height = cssHeight;

    if (w <= 0 || h <= 0) {
      if (lastBackingWidth !== 1) {
        canvas.width = 1;
        lastBackingWidth = 1;
      }
      if (lastBackingHeight !== 1) {
        canvas.height = 1;
        lastBackingHeight = 1;
      }
      lifecycle.logicalWidth = 0;
      lifecycle.logicalHeight = 0;
      onResize?.(0, 0, 1);
      return;
    }

    const scale = resolveCanvasBackingScale(w, h, backingScaleOptions);
    const backingWidth = Math.max(1, Math.floor(w * scale));
    const backingHeight = Math.max(1, Math.floor(h * scale));
    if (lastBackingWidth !== backingWidth) {
      canvas.width = backingWidth;
      lastBackingWidth = backingWidth;
    }
    if (lastBackingHeight !== backingHeight) {
      canvas.height = backingHeight;
      lastBackingHeight = backingHeight;
    }

    const prevW = lifecycle.logicalWidth;
    const prevH = lifecycle.logicalHeight;
    lifecycle.logicalWidth = w;
    lifecycle.logicalHeight = h;

    onResize?.(w, h, scale);
    if (prevW !== w || prevH !== h) {
      scheduleFrame();
    }
  }

  function isPaused() {
    if (!running || !active() || shouldReduceMotion()) return true;
    if (typeof document !== "undefined") {
      if (document.hidden) return true;
      if (pauseOnBlur && typeof document.hasFocus === "function" && !document.hasFocus()) return true;
    }
    return canvas.width < 2 || canvas.height < 2;
  }

  function scheduleFrame() {
    if (isPaused() || animFrameId !== null) return;
    animFrameId = requestAnimationFrame(frame);
  }

  function frame(now: number) {
    animFrameId = null;
    if (isPaused()) {
      lastTime = now;
      lastFrameAt = now;
      return;
    }

    const currentDpr = typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1;
    if (!ro || currentDpr !== lastDpr) {
      resize();
    }

    if (minFrameIntervalMs > 0 && now - lastFrameAt < minFrameIntervalMs) {
      scheduleFrame();
      return;
    }
    lastFrameAt = now;

    const dt = Math.min((now - lastTime) / 16.67, 3);
    lastTime = now;

    onFrame(now, dt, lifecycle.logicalWidth, lifecycle.logicalHeight);
    scheduleFrame();
  }

  function resume() {
    if (!running) return;
    resize();
    if (animFrameId !== null) return;
    lastTime = performance.now();
    lastFrameAt = 0;
    scheduleFrame();
  }

  function handleVisibilityChange() {
    if (typeof document !== "undefined" && !document.hidden && running) {
      resume();
    }
  }

  function handleWindowBlur() {
    if (pauseOnBlur && animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  resize();

  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(resize);
    ro.observe(activeParent);
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", resume);
  }

  if (immediate && !isPaused()) {
    // resize() above may have already queued a frame; drop it before running
    // the synchronous first frame so dispose() tracks the only pending id.
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    frame(lastTime);
  } else {
    scheduleFrame();
  }

  lifecycle.scheduleFrame = scheduleFrame;
  lifecycle.dispose = () => {
    running = false;
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    ro?.disconnect();
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", resume);
    }
  };

  return lifecycle;
}
