import { shouldReduceMotion } from "./animation-prefs";
import {
  combatantStatusPalette,
  combatantStatusProgress,
  combatantStatusWobbleDegrees,
  drawCombatantStatusEffect,
  drawCombatantStatusEffectStatic,
  type CombatantStatusEffectKind,
} from "./combatant-status-effect";

export interface CombatantStatusEffectFrame {
  progress: number;
  wobbleDegrees: number;
}

export function startCombatantStatusEffectLoop({
  canvas,
  kind,
  onFrame,
}: {
  canvas: HTMLCanvasElement;
  kind: CombatantStatusEffectKind;
  onFrame: (frame: CombatantStatusEffectFrame) => void;
}): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const palette = combatantStatusPalette(kind);
  let running = true;
  let rafId: number | null = null;
  const startTime = performance.now();
  let lastWidth = 0;
  let lastHeight = 0;
  let lastPixelRatio = 0;

  const resize = () => {
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = Math.max(Math.round(parent.clientWidth), 1);
    const h = Math.max(Math.round(parent.clientHeight), 1);
    const pixelRatio = Math.max(window.devicePixelRatio || 1, 1);
    if (w === lastWidth && h === lastHeight && pixelRatio === lastPixelRatio) return;
    lastWidth = w;
    lastHeight = h;
    lastPixelRatio = pixelRatio;
    canvas.width = Math.round(w * pixelRatio);
    canvas.height = Math.round(h * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };

  const paintStatic = () => {
    resize();
    drawCombatantStatusEffectStatic(ctx, lastWidth, lastHeight, kind, palette);
    onFrame({ progress: 0, wobbleDegrees: 0 });
  };

  if (shouldReduceMotion()) {
    paintStatic();
    return () => {
      running = false;
    };
  }

  let observer: ResizeObserver | null = null;

  const isPaused = () => {
    if (!running) return true;
    if (typeof document !== "undefined" && document.hidden) return true;
    return canvas.width < 2 || canvas.height < 2;
  };

  const scheduleFrame = () => {
    if (isPaused() || rafId !== null) return;
    rafId = requestAnimationFrame(frame);
  };

  const frame = (now: number) => {
    rafId = null;
    if (!running) return;
    if (isPaused()) return;

    if (!observer || Math.max(window.devicePixelRatio || 1, 1) !== lastPixelRatio) resize();
    const progress = combatantStatusProgress(now - startTime);
    drawCombatantStatusEffect(ctx, lastWidth, lastHeight, kind, progress, palette);
    onFrame({ progress, wobbleDegrees: combatantStatusWobbleDegrees(kind, progress) });
    scheduleFrame();
  };

  const resume = () => {
    if (!running) return;
    resize();
    scheduleFrame();
  };

  const handleVisibilityChange = () => {
    if (typeof document !== "undefined" && !document.hidden && running) resume();
  };

  const handleWindowBlur = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  resize();
  if (typeof ResizeObserver !== "undefined" && canvas.parentElement) {
    observer = new ResizeObserver(() => {
      if (!running) return;
      resize();
      scheduleFrame();
    });
    observer.observe(canvas.parentElement);
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", resume);
  }

  frame(startTime);

  return () => {
    running = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    observer?.disconnect();
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", resume);
    }
  };
}
