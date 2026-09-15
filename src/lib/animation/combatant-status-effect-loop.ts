import { shouldReduceMotion } from "./animation-prefs";
import { createCanvasLifecycle } from "./canvas-lifecycle";
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

  if (shouldReduceMotion()) {
    const parent = canvas.parentElement;
    if (parent) {
      const w = Math.max(Math.round(parent.clientWidth), 1);
      const h = Math.max(Math.round(parent.clientHeight), 1);
      const pixelRatio = typeof devicePixelRatio !== "undefined" ? Math.max(devicePixelRatio, 1) : 1;
      canvas.width = Math.round(w * pixelRatio);
      canvas.height = Math.round(h * pixelRatio);
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drawCombatantStatusEffectStatic(ctx, w, h, kind, palette);
    }
    onFrame({ progress: 0, wobbleDegrees: 0 });
    return () => {};
  }

  const startTime = performance.now();

  const lifecycle = createCanvasLifecycle({
    canvas,
    immediate: true,
    pauseOnBlur: false,
    backingScale: {
      scaleMultiplier: 1,
      minScale: 1,
      maxScale: 2,
      maxPixels: 1_000_000,
    },
    onResize: (_w, _h, scale) => {
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    },
    onFrame: (now, _dt, width, height) => {
      const progress = combatantStatusProgress(now - startTime);
      drawCombatantStatusEffect(ctx, width, height, kind, progress, palette);
      onFrame({ progress, wobbleDegrees: combatantStatusWobbleDegrees(kind, progress) });
    },
  });

  return () => {
    lifecycle.dispose();
  };
}
