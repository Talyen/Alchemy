import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

  it("resolves once the measured rect stops moving", async () => {
    const deps = makeDeps();
    const pending = waitForStableHandCardRect("slash-1", fallback, deps);
    flushFrames(500);
    await expect(pending).resolves.toEqual(rectA);
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
});
