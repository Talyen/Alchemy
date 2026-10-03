import { afterEach, describe, expect, it, vi } from "vitest";
import { batchedPreload, scheduleIdle, yieldToAnimationFrame } from "@/lib/preload/batched";
import { deferred } from "../../helpers/deferred";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("batchedPreload", () => {
  it("waits for every in-flight item before yielding and starting the next batch", async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    const load = vi.fn((item: number) => (item === 1 ? first.promise : item === 2 ? second.promise : undefined));
    const yieldBetweenBatches = vi.fn();
    const completion = batchedPreload([1, 2, 3], load, { batchSize: 2, yieldBetweenBatches });
    expect(load.mock.calls).toEqual([[1], [2]]);
    first.resolve();
    await first.promise;
    expect(yieldBetweenBatches).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(2);
    second.resolve();
    await completion;
    expect(load.mock.calls).toEqual([[1], [2], [3]]);
    expect(yieldBetweenBatches).toHaveBeenCalledOnce();
  });

  it("stops loading later batches when an item fails", async () => {
    const error = new Error("load failed");
    const load = vi.fn((item: number) => (item === 2 ? Promise.reject(error) : undefined));
    const yieldBetweenBatches = vi.fn();
    await expect(batchedPreload([1, 2, 3], load, { batchSize: 2, yieldBetweenBatches })).rejects.toBe(error);
    expect(load.mock.calls).toEqual([[1], [2]]);
    expect(yieldBetweenBatches).not.toHaveBeenCalled();
  });
});

describe("yieldToAnimationFrame", () => {
  it("finishes a suspended frame once and cleans up its timer and frame", async () => {
    vi.useFakeTimers();
    let callback: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", (next: FrameRequestCallback) => {
      callback = next;
      return 9;
    });
    const cancel = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const finished = vi.fn();
    const promise = yieldToAnimationFrame().then(finished);
    await vi.advanceTimersByTimeAsync(100);
    await promise;
    expect(finished).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledExactlyOnceWith(9);
    callback?.(200);
    expect(finished).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("finishes on the frame without retaining the fallback timer", async () => {
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
});

describe("scheduleIdle", () => {
  it("defers to pending input but eventually runs even if input stays busy", () => {
    const callbacks: IdleRequestCallback[] = [];
    vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.stubGlobal("navigator", { scheduling: { isInputPending: () => true } });
    const callback = vi.fn();
    scheduleIdle(callback);
    for (let index = 0; index < 3; index++) {
      callbacks[index]!({ didTimeout: false, timeRemaining: () => 50 });
      expect(callback).not.toHaveBeenCalled();
    }
    callbacks[3]!({ didTimeout: false, timeRemaining: () => 50 });
    expect(callback).toHaveBeenCalledOnce();
    expect(callbacks).toHaveLength(4);
  });

  it("honors an expired deadline despite pending input", () => {
    vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) => {
      callback({ didTimeout: true, timeRemaining: () => 0 });
      return 1;
    });
    vi.stubGlobal("navigator", { scheduling: { isInputPending: () => true } });
    const callback = vi.fn();
    scheduleIdle(callback);
    expect(callback).toHaveBeenCalledOnce();
  });

  it.each(["idle", "timer"])("contains callback failures on the %s path", (path) => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "requestIdleCallback",
      path === "idle"
        ? (callback: IdleRequestCallback) => {
            callback({ didTimeout: false, timeRemaining: () => 50 });
            return 1;
          }
        : undefined,
    );
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("warmup failed");
    const callback = vi.fn(() => {
      throw error;
    });
    expect(() => {
      scheduleIdle(callback);
      vi.runAllTimers();
    }).not.toThrow();
    expect(callback).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledExactlyOnceWith("scheduleIdle callback threw an error:", error);
  });
});
