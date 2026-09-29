import { attachWebGLContextLifecycle } from "./webgl-lifecycle";
import type { PlasmaRendererOptions } from "./keyword-plasma-types";
import { startWebGLKeywordPlasma } from "./keyword-plasma-webgl";

export function startKeywordPlasma(options: PlasmaRendererOptions): () => void {
  return attachWebGLContextLifecycle({
    canvas: options.canvas,
    start: () => startWebGLKeywordPlasma(options),
    onAvailabilityChange: options.onAvailabilityChange,
    unavailableErrorMessage: "Plasma WebGL unavailable; using static decoration",
    contextLostErrorMessage: "Plasma WebGL context lost; using static decoration",
  });
}

export type { PlasmaColorState, PlasmaRendererOptions } from "./keyword-plasma-types";
