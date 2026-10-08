import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  waitForStableHandCardRect,
  type StableHandCardRectDeps,
} from "@/features/alchemy/run-loop/battle/card-transfer-animations";

const rectA = { x: 10, y: 20, width: 80, height: 120 };
const rectB = { x: 30, y: 40, width: 80, height: 120 };
const fallback = { x: 0, y: 0, width: 40, height: 60 };

function makeDeps(overrides: Partial<StableHandCardRectDeps> = {}): StableHandCardRectDeps & {
  cancels: Array<() => void>;
  timeouts: Array<() => void>;
} {
  const cancels: Array<() => void> = [];
  const timeouts: Array<() => void> = [];
  return {
    cancels,
    timeouts,
    measureHandCard: () => ({ ...rectA }),
    registerCancel: (callback: () => void) => {
      cancels.push(callback);
      return () => {};
    },
    scheduleTimeout: (callback: () => void) => {
      timeouts.push(callback);
      return () => {};
    },
    ...overrides,
  };
}

describe("waitForStableHandCardRect", () => {
  const raf = globalThis.requestAnimationFrame;
  const caf = globalThis.cancelAnimationFrame;
  let rafQueue: FrameRequestCallback[] = [];

  beforeEach(() => {
    rafQueue = [];
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      rafQueue.push(callback);
      return rafQueue.length;
    };
    globalThis.cancelAnimationFrame = () => {};
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = raf;
    globalThis.cancelAnimationFrame = caf;
  });

  function flushFrames(count: number) {
    for (let index = 0; index < count; index += 1) {
      const pending = rafQueue;
      rafQueue = [];
      if (pending.length === 0) return;
      for (const callback of pending) callback(0);
    }
  }

  it("waits for size as well as position to settle before drawing a card", async () => {
    const measureHandCard = vi
      .fn()
      .mockReturnValueOnce(rectA)
      .mockReturnValueOnce({ ...rectA, width: 90 })
      .mockReturnValueOnce({ ...rectA, width: 90, height: 135 })
      .mockReturnValue(rectB);
    const deps = makeDeps({ measureHandCard });
    const pending = waitForStableHandCardRect("slash-1", fallback, deps);
    const completed = vi.fn();
    void pending.then(completed);
    flushFrames(3);
    await Promise.resolve();
    expect(completed).not.toHaveBeenCalled();
    flushFrames(3);
    await expect(pending).resolves.toEqual(rectB);
  });

  it("waits for a missing hand slot and restarts stability after a measurement gap", async () => {
    const measureHandCard = vi
      .fn()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(rectA)
      .mockReturnValueOnce(rectA)
      .mockReturnValueOnce(null)
      .mockReturnValue(rectB);
    const pending = waitForStableHandCardRect("slash-1", fallback, makeDeps({ measureHandCard }));
    const completed = vi.fn();
    void pending.then(completed);
    flushFrames(3);
    await Promise.resolve();
    expect(completed).not.toHaveBeenCalled();
    flushFrames(5);
    await Promise.resolve();
    expect(completed).not.toHaveBeenCalled();
    flushFrames(1);
    await expect(pending).resolves.toEqual(rectB);
  });

  it("resolves with the live measurement when cancellation wins the race", async () => {
    const deps = makeDeps();
    const pending = waitForStableHandCardRect("slash-1", fallback, deps);
    // No frames run: cancellation finishes the wait with whatever is measured
    // now, instead of waiting for stability or the timeout.
    deps.cancels.forEach((cancel) => cancel());
    await expect(pending).resolves.toEqual(rectA);
  });

  it("resolves with the fallback when nothing is measurable and cancel fires", async () => {
    const deps = makeDeps({ measureHandCard: () => null });
    const pending = waitForStableHandCardRect("slash-1", fallback, deps);
    flushFrames(1);
    deps.cancels.forEach((cancel) => cancel());
    await expect(pending).resolves.toEqual(fallback);
  });

  it("resolves via the scheduled timeout without waiting for stability", async () => {
    let calls = 0;
    const deps = makeDeps({
      measureHandCard: () => (calls++ % 2 === 0 ? { ...rectA } : { ...rectB }),
    });
    const pending = waitForStableHandCardRect("slash-1", fallback, deps);
    deps.timeouts.forEach((fire) => fire());
    await expect(pending).resolves.toEqual(rectA);
  });

  it("keeps the frame limit as a fallback when a hand slot never mounts", async () => {
    const pending = waitForStableHandCardRect("slash-1", fallback, makeDeps({ measureHandCard: () => null }));
    flushFrames(500);
    await expect(pending).resolves.toEqual(fallback);
    expect(rafQueue).toEqual([]);
  });

  it("rejects a failed frame measurement and cancels the remaining timeout", async () => {
    const clearTimeout = vi.fn();
    const unregister = vi.fn();
    const failure = new Error("hand measurement failed");
    const deps = makeDeps({
      measureHandCard: () => {
        throw failure;
      },
      registerCancel: () => unregister,
      scheduleTimeout: () => clearTimeout,
    });
    const pending = waitForStableHandCardRect("slash-1", fallback, deps);
    flushFrames(1);
    await expect(pending).rejects.toBe(failure);
    expect(clearTimeout).toHaveBeenCalledOnce();
    expect(unregister).toHaveBeenCalledOnce();
    expect(rafQueue).toEqual([]);
  });

  it.each(["registration", "timeout"])(
    "cleans up synchronous settlement during %s without starting frames",
    async (seam) => {
      const unregister = vi.fn();
      const clearTimeout = vi.fn();
      const scheduleTimeout = vi.fn((callback: () => void) => {
        if (seam === "timeout") callback();
        return clearTimeout;
      });
      const pending = waitForStableHandCardRect(
        "slash-1",
        fallback,
        makeDeps({
          registerCancel: (callback) => {
            if (seam === "registration") callback();
            return unregister;
          },
          scheduleTimeout,
        }),
      );
      await expect(pending).resolves.toEqual(rectA);
      expect(unregister).toHaveBeenCalledOnce();
      expect(scheduleTimeout).toHaveBeenCalledTimes(seam === "timeout" ? 1 : 0);
      expect(clearTimeout).toHaveBeenCalledTimes(seam === "timeout" ? 1 : 0);
      expect(rafQueue).toEqual([]);
    },
  );
});
