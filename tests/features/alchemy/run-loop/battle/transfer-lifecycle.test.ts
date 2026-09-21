import { describe, expect, it, vi } from "vitest";
import { PlaybackLifetime } from "@/features/alchemy/run-loop/battle/playback-lifetime";

describe("PlaybackLifetime", () => {
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
