import { describe, expect, it, vi } from "vitest";
import { PlaybackLifetime } from "@/features/alchemy/run-loop/battle/playback-lifetime";
import { runPlaybackTask } from "@/features/alchemy/run-loop/battle/playback-task";

describe("PlaybackLifetime", () => {
  it("settles a suspended frame on cancellation without leaking into a restarted battle", async () => {
    const frame = vi.fn(() => 42);
    const cancelFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", frame);
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
    try {
      const lifetime = new PlaybackLifetime();
      const waiting = lifetime.waitForFrame(lifetime.id);
      lifetime.restart();
      await expect(waiting).resolves.toBe(false);
      expect(cancelFrame).toHaveBeenCalledWith(42);
      expect(lifetime.pendingDraws).toBe(0);
      expect(lifetime.canAcceptInput()).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("ignores an old frame delivered after restart while the new wait remains active", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    try {
      const lifetime = new PlaybackLifetime();
      const oldWait = lifetime.waitForFrame(lifetime.id);
      lifetime.restart();
      const newWait = lifetime.waitForFrame(lifetime.id);
      frames[0]!(0);
      await expect(oldWait).resolves.toBe(false);
      frames[1]!(0);
      await expect(newWait).resolves.toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("unregisters callbacks so cancelAll skips them", () => {
    const registry = new PlaybackLifetime();
    const callback = vi.fn();
    const unregister = registry.registerCancel(callback);
    unregister();
    registry.cancelTransfers();
    expect(callback).not.toHaveBeenCalled();
  });

  it("invokes all registered callbacks on cancelAll", () => {
    const registry = new PlaybackLifetime();
    const first = vi.fn();
    const second = vi.fn();
    registry.registerCancel(first);
    registry.registerCancel(second);
    registry.cancelTransfers();
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    const third = vi.fn();
    registry.registerCancel(third);
    registry.cancelTransfers();
    expect(third).toHaveBeenCalledOnce();
  });
});

describe("playback task resources", () => {
  it("cleans up and rejects a failed scheduled operation without executing late callbacks", async () => {
    const lifetime = new PlaybackLifetime();
    const releaseVisibleState = vi.fn();
    const clearScheduledCallback = vi.fn();
    const lateEffect = vi.fn();
    let fire = () => {};
    let fireLate = () => {};
    const failure = new Error("measurement failed");
    const pending = runPlaybackTask(
      (callback) => lifetime.registerCancel(callback),
      () => false,
      (task) => {
        task.own(releaseVisibleState);
        task.schedule(
          (callback) => {
            fire = callback;
            return () => {};
          },
          () => {
            throw failure;
          },
        );
        task.schedule((callback) => {
          fireLate = callback;
          return clearScheduledCallback;
        }, lateEffect);
      },
    );
    fire();
    await expect(pending).rejects.toBe(failure);
    lifetime.cancelTransfers();
    fireLate();
    expect(releaseVisibleState).toHaveBeenCalledOnce();
    expect(clearScheduledCallback).toHaveBeenCalledOnce();
    expect(lateEffect).not.toHaveBeenCalled();
  });

  it("releases all resources even when one cleanup fails", async () => {
    const lifetime = new PlaybackLifetime();
    const releaseTimer = vi.fn();
    const pending = runPlaybackTask(
      (callback) => lifetime.registerCancel(callback),
      () => false,
      (task) => {
        task.own(() => {
          throw new Error("overlay cleanup failed");
        });
        task.own(releaseTimer);
      },
    );
    lifetime.cancelTransfers();
    await expect(pending).rejects.toThrow("Battle playback cleanup failed");
    expect(releaseTimer).toHaveBeenCalledOnce();
  });
});

it("cancels the entire lifetime and ignores stale draw completions after restart", () => {
  vi.useFakeTimers();
  try {
    const lifetime = new PlaybackLifetime();
    const oldId = lifetime.id;
    const signal = lifetime.signal;
    const oldDraw = lifetime.beginDraw(oldId);
    const cancelled = vi.fn();
    const timer = vi.fn();
    lifetime.registerCancel(cancelled);
    lifetime.timers.setTimeout(timer, 10);
    expect(lifetime.finish()).toBe(true);
    expect(lifetime.finish()).toBe(false);
    lifetime.restart();
    const newDraw = lifetime.beginDraw(lifetime.id);
    oldDraw();
    expect(lifetime.pendingDraws).toBe(1);
    expect(lifetime.isCurrent(oldId)).toBe(false);
    expect(signal.aborted).toBe(true);
    expect(cancelled).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(timer).not.toHaveBeenCalled();
    newDraw();
    newDraw();
    expect(lifetime.pendingDraws).toBe(0);
    expect(lifetime.finish()).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});
