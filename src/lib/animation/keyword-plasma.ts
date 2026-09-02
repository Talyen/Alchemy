import { startCanvasKeywordPlasma } from "./keyword-plasma-canvas";
import type { PlasmaRendererMode, PlasmaRendererOptions, StartPlasmaRenderer } from "./keyword-plasma-types";

const BACKENDS: Record<PlasmaRendererMode, StartPlasmaRenderer> = {
  canvas: startCanvasKeywordPlasma,
  webgl: startCanvasKeywordPlasma,
};

export function startKeywordPlasma(mode: PlasmaRendererMode, options: PlasmaRendererOptions): () => void {
  return BACKENDS[mode](options);
}

export type { PlasmaColorState, PlasmaRendererMode, PlasmaRendererOptions } from "./keyword-plasma-types";
