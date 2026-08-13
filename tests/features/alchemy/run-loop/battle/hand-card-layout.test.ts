import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { waitForStableHandCardRect } from "@/features/alchemy/run-loop/battle/hand-card-layout";

const fallback = { x: 0, y: 0, width: 80, height: 120 };
const stable = { x: 10, y: 20, width: 80, height: 120 };

describe("waitForStableHandCardRect", () => {
  const raf = globalThis.requestAnimationFrame;

  beforeEach(() => {
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    };
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = raf;
  });

  it("resolves after enough stable frames", async () => {
    const result = await waitForStableHandCardRect("slash-1", fallback, {
      measureHandCard: vi.fn(() => stable),
      registerCancel: () => () => {},
      scheduleTimeout: (_cb, _ms) => () => {},
    });

    expect(result).toEqual(stable);
  });

  it("uses the timeout fallback when layout never stabilizes", async () => {
    let timeoutCb: (() => void) | null = null;

    const deps: import("@/features/alchemy/run-loop/battle/hand-card-layout").StableHandCardRectDeps = {
      measureHandCard: vi.fn(() => null),
      registerCancel: () => () => {},
      scheduleTimeout: (cb, _ms) => {
        timeoutCb = cb;
        return () => {};
      },
    };
    const promise = waitForStableHandCardRect("slash-1", fallback, deps);

    timeoutCb!();
    await expect(promise).resolves.toEqual(fallback);
  });

  it("finishes immediately when cancel fires", async () => {
    const measured = { x: 5, y: 6, width: 80, height: 120 };
    let cancelCb: (() => void) | null = null;

    const promise = waitForStableHandCardRect("slash-1", fallback, {
      measureHandCard: vi.fn(() => measured),
      registerCancel: (cb) => {
        cancelCb = cb;
        return () => {};
      },
      scheduleTimeout: (_cb, _ms) => () => {},
    });

    cancelCb!();
    await expect(promise).resolves.toEqual(measured);
  });

  it("handles cancellation that fires synchronously during registration", async () => {
    const unregister = vi.fn();
    const scheduleTimeout = vi.fn(() => vi.fn());
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame");

    const promise = waitForStableHandCardRect("slash-1", fallback, {
      measureHandCard: vi.fn(() => stable),
      registerCancel: (cb) => {
        cb();
        return unregister;
      },
      scheduleTimeout,
    });

    await expect(promise).resolves.toEqual(stable);
    expect(unregister).toHaveBeenCalledOnce();
    expect(scheduleTimeout).not.toHaveBeenCalled();
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it("handles a timeout that fires synchronously during scheduling", async () => {
    const unregister = vi.fn();
    const clearTimeout = vi.fn();
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame");

    const promise = waitForStableHandCardRect("slash-1", fallback, {
      measureHandCard: vi.fn(() => stable),
      registerCancel: () => unregister,
      scheduleTimeout: (cb) => {
        cb();
        return clearTimeout;
      },
    });

    await expect(promise).resolves.toEqual(stable);
    expect(unregister).toHaveBeenCalledOnce();
    expect(clearTimeout).toHaveBeenCalledOnce();
    expect(rafSpy).not.toHaveBeenCalled();
  });
});
