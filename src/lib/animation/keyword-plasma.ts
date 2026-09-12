import { logError } from "../error-logger";
import type { PlasmaRendererOptions } from "./keyword-plasma-types";
import { startWebGLKeywordPlasma } from "./keyword-plasma-webgl";

export function startKeywordPlasma(options: PlasmaRendererOptions): () => void {
  let stop: (() => void) | null = null;
  let disposed = false;

  function start() {
    if (disposed) return;
    stop = startWebGLKeywordPlasma(options);
    options.onAvailabilityChange?.(stop !== null);
    if (!stop) logError("Plasma WebGL unavailable; using static decoration", "other");
  }
  function lost(event: Event) {
    event.preventDefault(); // Permit the browser to restore this context.
    stop?.();
    stop = null;
    options.onAvailabilityChange?.(false);
    logError("Plasma WebGL context lost; using static decoration", "other");
  }
  function restored() {
    stop?.();
    start();
  }
  options.canvas.addEventListener("webglcontextlost", lost);
  options.canvas.addEventListener("webglcontextrestored", restored);
  start();
  return () => {
    disposed = true;
    options.canvas.removeEventListener("webglcontextlost", lost);
    options.canvas.removeEventListener("webglcontextrestored", restored);
    stop?.();
    stop = null;
  };
}

export type { PlasmaColorState, PlasmaRendererOptions } from "./keyword-plasma-types";
