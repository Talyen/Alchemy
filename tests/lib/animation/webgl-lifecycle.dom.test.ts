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

  it("falls back after failed startup and retries when the context is restored", () => {
    const stop = vi.fn();
    const start = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("startup failed");
      })
      .mockReturnValue(stop);
    const available = vi.fn();
    const detach = attachWebGLContextLifecycle({ canvas, start, onAvailabilityChange: available });
    expect(available).toHaveBeenLastCalledWith(false);
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(available).toHaveBeenLastCalledWith(true);
    detach();
    expect(stop).toHaveBeenCalledOnce();
  });

  it("revokes a renderer that loses its context before startup returns", () => {
    const interruptedStop = vi.fn();
    const restoredStop = vi.fn();
    const start = vi
      .fn()
      .mockImplementationOnce(() => {
        canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
        return interruptedStop;
      })
      .mockReturnValue(restoredStop);
    const available = vi.fn();
    const detach = attachWebGLContextLifecycle({ canvas, start, onAvailabilityChange: available });
    expect(interruptedStop).toHaveBeenCalledOnce();
    expect(available.mock.calls).toEqual([[false]]);
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(available).toHaveBeenLastCalledWith(true);
    detach();
    expect(interruptedStop).toHaveBeenCalledOnce();
    expect(restoredStop).toHaveBeenCalledOnce();
  });

  it("isolates observer and teardown failures without losing the next renderer", () => {
    const oldStop = vi.fn(() => {
      throw new Error("cleanup failed");
    });
    const nextStop = vi.fn();
    const start = vi.fn().mockReturnValueOnce(oldStop).mockReturnValue(nextStop);
    const detach = attachWebGLContextLifecycle({
      canvas,
      start,
      onAvailabilityChange: () => {
        throw new Error("observer failed");
      },
    });
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    detach();
    detach();
    expect(start).toHaveBeenCalledTimes(2);
    expect(oldStop).toHaveBeenCalledOnce();
    expect(nextStop).toHaveBeenCalledOnce();
  });
});
