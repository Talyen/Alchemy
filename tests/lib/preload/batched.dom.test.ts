import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { batchedPreload, scheduleIdle, yieldToAnimationFrame } from "@/lib/preload/batched";

describe("batchedPreload", () => {
  it("processes items in bounded batches and yields between them", async () => {
    const items = [1, 2, 3, 4, 5];
    const processed: number[] = [];
    const yields: number[] = [];

    await batchedPreload(
      items,
      async (n) => {
        processed.push(n);
      },
      {
        batchSize: 2,
        yieldBetweenBatches: async () => {
          yields.push(processed.length);
        },
      },
    );

    expect(processed).toEqual([1, 2, 3, 4, 5]);
    // Yields should happen after batch 1 (size 2) and batch 2 (size 2), but not after the final single-element batch
    expect(yields).toEqual([2, 4]);
  });

  it("handles empty items without yielding", async () => {
    const yieldFn = vi.fn();
    await batchedPreload([], vi.fn(), { yieldBetweenBatches: yieldFn });
    expect(yieldFn).not.toHaveBeenCalled();
  });

  it("handles batchSize larger than item count without yielding", async () => {
    const yieldFn = vi.fn();
    const processed: number[] = [];
    await batchedPreload(
      [1, 2],
      (n) => {
        processed.push(n);
      },
      {
        batchSize: 10,
        yieldBetweenBatches: yieldFn,
      },
    );
    expect(processed).toEqual([1, 2]);
    expect(yieldFn).not.toHaveBeenCalled();
  });

  it("falls back to default batch size for NaN, zero, or negative batch sizes", async () => {
    const items = [1, 2, 3, 4, 5, 6];
    const yields: number[] = [];
    const yieldFn = vi.fn(async () => {
      yields.push(1);
    });

    await batchedPreload(items, vi.fn(), {
      batchSize: Number.NaN,
      yieldBetweenBatches: yieldFn,
    });
    // Default batch size is 4. For 6 items, batch 1 is 4 items, batch 2 is 2 items -> 1 yield
    expect(yieldFn).toHaveBeenCalledTimes(1);

    yieldFn.mockClear();
    await batchedPreload(items, vi.fn(), {
      batchSize: 0,
      yieldBetweenBatches: yieldFn,
    });
    expect(yieldFn).toHaveBeenCalledTimes(1);
  });

  it("propagates rejections from loadOne", async () => {
    const error = new Error("load failed");
    await expect(
      batchedPreload([1, 2], (n) => {
        if (n === 2) throw error;
      }),
    ).rejects.toThrow("load failed");
  });
});

describe("yieldToAnimationFrame", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses requestAnimationFrame when available", async () => {
    const rafMock = vi.fn((cb: FrameRequestCallback) => {
      cb(100);
      return 1;
    });
    vi.stubGlobal("requestAnimationFrame", rafMock);

    await yieldToAnimationFrame();
    expect(rafMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to setTimeout when requestAnimationFrame is not available", async () => {
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.useFakeTimers();

    const promise = yieldToAnimationFrame();
    vi.advanceTimersByTime(0);
    await promise;

    vi.useRealTimers();
  });
});

describe("scheduleIdle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("schedules via requestIdleCallback when supported", () => {
    const ricMock = vi.fn((cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    });
    vi.stubGlobal("requestIdleCallback", ricMock);

    const callback = vi.fn();
    scheduleIdle(callback);

    expect(ricMock).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("reschedules up to 3 times when input is pending and deadline has not timed out", () => {
    const ricCallbacks: IdleRequestCallback[] = [];
    vi.stubGlobal(
      "requestIdleCallback",
      vi.fn((cb: IdleRequestCallback) => {
        ricCallbacks.push(cb);
        return ricCallbacks.length;
      }),
    );

    const isInputPending = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", {
      scheduling: { isInputPending },
    });

    const callback = vi.fn();
    scheduleIdle(callback);

    expect(ricCallbacks).toHaveLength(1);
    // 1st callback: input pending -> reschedules (retries: 1)
    ricCallbacks[0]!({ didTimeout: false, timeRemaining: () => 50 });
    expect(ricCallbacks).toHaveLength(2);
    expect(callback).not.toHaveBeenCalled();

    // 2nd callback: input pending -> reschedules (retries: 2)
    ricCallbacks[1]!({ didTimeout: false, timeRemaining: () => 50 });
    expect(ricCallbacks).toHaveLength(3);
    expect(callback).not.toHaveBeenCalled();

    // 3rd callback: input pending -> reschedules (retries: 3)
    ricCallbacks[2]!({ didTimeout: false, timeRemaining: () => 50 });
    expect(ricCallbacks).toHaveLength(4);
    expect(callback).not.toHaveBeenCalled();

    // 4th callback: retries is now 3, so it executes despite input pending
    ricCallbacks[3]!({ didTimeout: false, timeRemaining: () => 50 });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("executes immediately without rescheduling if deadline didTimeout is true", () => {
    const ricCallbacks: IdleRequestCallback[] = [];
    vi.stubGlobal(
      "requestIdleCallback",
      vi.fn((cb: IdleRequestCallback) => {
        ricCallbacks.push(cb);
        return 1;
      }),
    );

    const isInputPending = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", {
      scheduling: { isInputPending },
    });

    const callback = vi.fn();
    scheduleIdle(callback);

    // didTimeout is true: should NOT reschedule even if isInputPending is true
    ricCallbacks[0]!({ didTimeout: true, timeRemaining: () => 0 });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(ricCallbacks).toHaveLength(1);
  });

  it("falls back to setTimeout when requestIdleCallback is unavailable", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    // In JSDOM, window.requestIdleCallback exists on window object; remove it
    if ("requestIdleCallback" in window) {
      delete (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback;
    }

    const callback = vi.fn();
    scheduleIdle(callback);

    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(callback).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("catches callback errors gracefully without uncaught rejection", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const ricMock = vi.fn((cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    });
    vi.stubGlobal("requestIdleCallback", ricMock);

    expect(() => {
      scheduleIdle(() => {
        throw new Error("unhandled callback error");
      });
    }).not.toThrow();

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
