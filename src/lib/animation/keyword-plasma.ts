// Keyword plasma renderer entry — dispatches to canvas or WebGL backends.
import { startCanvasKeywordPlasma } from "./keyword-plasma-canvas";
import type { PlasmaRendererMode, PlasmaRendererOptions, StartPlasmaRenderer } from "./keyword-plasma-types";
import { startWebGLKeywordPlasma } from "./keyword-plasma-webgl";

const BACKENDS: Record<PlasmaRendererMode, StartPlasmaRenderer> = {
  canvas: startCanvasKeywordPlasma,
  webgl: startWebGLKeywordPlasma,
};

export function startKeywordPlasma(mode: PlasmaRendererMode, options: PlasmaRendererOptions): () => void {
  return BACKENDS[mode](options);
}

export type { PlasmaColorState, PlasmaRendererMode, PlasmaRendererOptions } from "./keyword-plasma-types";
