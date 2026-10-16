import { logError } from "../error-logger";

export interface WebGLContextLifecycleOptions {
  canvas: HTMLCanvasElement;
  start: () => (() => void) | null;
  onAvailabilityChange?: ((available: boolean) => void) | undefined;
  unavailableErrorMessage?: string | undefined;
  contextLostErrorMessage?: string | undefined;
}

/** Owns renderer replacement and fallback, including failures in host callbacks. */
export function attachWebGLContextLifecycle({
  canvas,
  start,
  onAvailabilityChange,
  unavailableErrorMessage,
  contextLostErrorMessage,
}: WebGLContextLifecycleOptions): () => void {
  let stop: (() => void) | null = null;
  let disposed = false;
  let generation = 0;

  function releaseRenderer(renderer: (() => void) | null) {
    try {
      renderer?.();
    } catch (error) {
      logError("WebGL renderer cleanup failed", "other", undefined, undefined, undefined, error);
    }
  }

  function release() {
    const previous = stop;
    stop = null;
    releaseRenderer(previous);
  }

  function notify(available: boolean) {
    try {
      onAvailabilityChange?.(available);
    } catch (error) {
      logError("WebGL availability observer failed", "other", undefined, undefined, undefined, error);
    }
  }

  function initialize() {
    if (disposed) return;
    const current = ++generation;
    release();
    // Cleanup can dispatch another context event or dispose the owner.
    if (disposed || current !== generation) return;
    let renderer: (() => void) | null = null;
    try {
      renderer = start();
    } catch (error) {
      logError("WebGL renderer initialization failed", "other", undefined, undefined, undefined, error);
    }
    if (disposed || current !== generation) {
      // Startup may synchronously lose its context. A late disposer still
      // belongs to the interrupted generation, never the replacement renderer.
      releaseRenderer(renderer);
      return;
    }
    stop = renderer;
    const available = renderer !== null;
    notify(available);
    if (!available && unavailableErrorMessage) logError(unavailableErrorMessage, "other");
  }

  function handleLost(event: Event) {
    event.preventDefault();
    if (disposed) return;
    const current = ++generation;
    release();
    if (disposed || current !== generation) return;
    notify(false);
    if (contextLostErrorMessage) logError(contextLostErrorMessage, "other");
  }

  canvas.addEventListener("webglcontextlost", handleLost);
  canvas.addEventListener("webglcontextrestored", initialize);
  initialize();

  return () => {
    if (disposed) return;
    disposed = true;
    generation++;
    canvas.removeEventListener("webglcontextlost", handleLost);
    canvas.removeEventListener("webglcontextrestored", initialize);
    release();
  };
}
