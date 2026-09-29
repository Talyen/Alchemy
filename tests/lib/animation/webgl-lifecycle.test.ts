import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachWebGLContextLifecycle } from "@/lib/animation/webgl-lifecycle";
import { logError } from "@/lib/error-logger";

vi.mock("@/lib/error-logger", () => ({ logError: vi.fn() }));

describe("attachWebGLContextLifecycle", () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    vi.clearAllMocks();
    canvas = document.createElement("canvas");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invokes start on initialization and reports availability", () => {
    const stop = vi.fn();
    const onAvailabilityChange = vi.fn();

    const detach = attachWebGLContextLifecycle({
      canvas,
      start: () => stop,
      onAvailabilityChange,
    });

    expect(onAvailabilityChange).toHaveBeenCalledWith(true);
    detach();
    expect(stop).toHaveBeenCalledOnce();
  });

  it("logs unavailable error when start returns null", () => {
    const onAvailabilityChange = vi.fn();

    const detach = attachWebGLContextLifecycle({
      canvas,
      start: () => null,
      onAvailabilityChange,
      unavailableErrorMessage: "WebGL failed to initialize",
    });

    expect(onAvailabilityChange).toHaveBeenCalledWith(false);
    expect(logError).toHaveBeenCalledWith("WebGL failed to initialize", "other");
    detach();
  });

  it("handles webglcontextlost by stopping resources and notifying availability", () => {
    const stop = vi.fn();
    const onAvailabilityChange = vi.fn();

    const detach = attachWebGLContextLifecycle({
      canvas,
      start: () => stop,
      onAvailabilityChange,
      contextLostErrorMessage: "Context was lost",
    });

    const lostEvent = new Event("webglcontextlost", { cancelable: true });
    canvas.dispatchEvent(lostEvent);

    expect(lostEvent.defaultPrevented).toBe(true);
    expect(stop).toHaveBeenCalledOnce();
    expect(onAvailabilityChange).toHaveBeenLastCalledWith(false);
    expect(logError).toHaveBeenCalledWith("Context was lost", "other");

    detach();
  });

  it("handles webglcontextrestored by re-invoking start", () => {
    const stop1 = vi.fn();
    const stop2 = vi.fn();
    let invocation = 0;
    const onAvailabilityChange = vi.fn();

    const detach = attachWebGLContextLifecycle({
      canvas,
      start: () => (++invocation === 1 ? stop1 : stop2),
      onAvailabilityChange,
    });

    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    canvas.dispatchEvent(new Event("webglcontextrestored"));

    expect(onAvailabilityChange).toHaveBeenLastCalledWith(true);
    detach();
    expect(stop2).toHaveBeenCalledOnce();
  });
});
