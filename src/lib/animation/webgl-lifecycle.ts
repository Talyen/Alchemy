import { logError } from "../error-logger";

export interface WebGLContextLifecycleOptions {
  canvas: HTMLCanvasElement;
  start: () => (() => void) | null;
  onAvailabilityChange?: ((available: boolean) => void) | undefined;
  unavailableErrorMessage?: string | undefined;
  contextLostErrorMessage?: string | undefined;
}

/**
 * Manages WebGL context loss and restoration event listeners, availability notifications,
 * and graceful fallback teardown/rebuild.
 */
export function attachWebGLContextLifecycle({
  canvas,
  start,
  onAvailabilityChange,
  unavailableErrorMessage,
  contextLostErrorMessage,
}: WebGLContextLifecycleOptions): () => void {
  let stop: (() => void) | null = null;
  let disposed = false;

  function initialize() {
    if (disposed) return;
    stop = start();
    const available = stop !== null;
    onAvailabilityChange?.(available);
    if (!available && unavailableErrorMessage) {
      logError(unavailableErrorMessage, "other");
    }
  }

  function handleLost(event: Event) {
    event.preventDefault(); // Permit browser to restore the context
    stop?.();
    stop = null;
    onAvailabilityChange?.(false);
    if (contextLostErrorMessage) {
      logError(contextLostErrorMessage, "other");
    }
  }

  function handleRestored() {
    stop?.();
    initialize();
  }

  canvas.addEventListener("webglcontextlost", handleLost);
  canvas.addEventListener("webglcontextrestored", handleRestored);
  initialize();

  return () => {
    disposed = true;
    canvas.removeEventListener("webglcontextlost", handleLost);
    canvas.removeEventListener("webglcontextrestored", handleRestored);
    stop?.();
    stop = null;
  };
}
