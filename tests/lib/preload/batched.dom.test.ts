import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleIdle, yieldToAnimationFrame } from "@/lib/preload/batched";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("yieldToAnimationFrame", () => {
  it("settles on the frame and releases the fallback timer", async () => {
    vi.useFakeTimers();
    let callback: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", (next: FrameRequestCallback) => {
      callback = next;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const promise = yieldToAnimationFrame();
    callback?.(100);
    await promise;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("still settles when frames never fire", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", () => 9);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const promise = yieldToAnimationFrame();
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("scheduleIdle", () => {
  it("runs on the next idle slot", () => {
    vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) => {
      callback({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    });
    const callback = vi.fn();
    scheduleIdle(callback);
    expect(callback).toHaveBeenCalledOnce();
  });

  it("falls back to a timer without idle support", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    const callback = vi.fn();
    scheduleIdle(callback);
    expect(callback).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(callback).toHaveBeenCalledOnce();
  });
});
