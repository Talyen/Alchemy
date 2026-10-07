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

  it("releases each renderer once across context loss, restoration and disposal", () => {
    const firstStop = vi.fn();
    const restoredStop = vi.fn();
    const start = vi.fn().mockReturnValueOnce(firstStop).mockReturnValueOnce(restoredStop);
    const onAvailabilityChange = vi.fn();
    const detach = attachWebGLContextLifecycle({
      canvas,
      start,
      onAvailabilityChange,
      contextLostErrorMessage: "Context was lost",
    });

    const lostEvent = new Event("webglcontextlost", { cancelable: true });
    canvas.dispatchEvent(lostEvent);
    expect(lostEvent.defaultPrevented).toBe(true);
    expect(firstStop).toHaveBeenCalledOnce();
    expect(logError).toHaveBeenCalledWith("Context was lost", "other");
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(onAvailabilityChange.mock.calls).toEqual([[true], [false], [true]]);
    expect(start).toHaveBeenCalledTimes(2);

    detach();
    detach();
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(firstStop).toHaveBeenCalledOnce();
    expect(restoredStop).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledTimes(2);
    expect(onAvailabilityChange).toHaveBeenCalledTimes(3);
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
});
