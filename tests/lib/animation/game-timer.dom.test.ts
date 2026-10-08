import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { delay, TimerGroup } from "@/lib/animation/game-timer";

describe("game timers", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("cancels departed-screen work without canceling surviving work", () => {
    const timers = new TimerGroup();
    const departed = vi.fn();
    const surviving = vi.fn();
    const cancel = timers.setTimeout(departed, 100);
    timers.setTimeout(surviving, 200);
    cancel();
    cancel();
    vi.advanceTimersByTime(199);
    expect(departed).not.toHaveBeenCalled();
    expect(surviving).not.toHaveBeenCalled();
    expect(timers.size).toBe(1);
    vi.advanceTimersByTime(1);
    expect(surviving).toHaveBeenCalledOnce();
    expect(timers.size).toBe(0);
  });

  it("disposes callbacks scheduled by another callback and can be reused", () => {
    const timers = new TimerGroup();
    const stale = vi.fn();
    const fresh = vi.fn();
    timers.setTimeout(() => timers.setTimeout(stale, 100), 10);
    vi.advanceTimersByTime(10);
    timers.clearAll();
    timers.clearAll();
    timers.setTimeout(fresh, 20);
    vi.advanceTimersByTime(100);
    expect(stale).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledOnce();
    expect(timers.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores late callbacks from cancelled work while letting a reused group finish once", () => {
    const callbacks: Array<() => void> = [];
    const timers = new TimerGroup({
      setTimeout: (callback) => {
        callbacks.push(callback);
        return 1;
      },
      clearTimeout: vi.fn(),
    });
    const stale = vi.fn();
    const cancelStale = timers.setTimeout(stale, 10);
    cancelStale();
    timers.setTimeout(stale, 20);
    timers.clearAll();
    const fresh = vi.fn();
    timers.setTimeout(fresh, 30);
    cancelStale();
    callbacks[0]!();
    callbacks[1]!();
    expect(stale).not.toHaveBeenCalled();
    expect(fresh).not.toHaveBeenCalled();
    callbacks[2]!();
    callbacks[2]!();
    expect(fresh).toHaveBeenCalledOnce();
    expect(timers.size).toBe(0);
  });

  it.each([false, true])(
    "keeps game work and real-time deadlines distinct with animations disabled: %s",
    async (disabled) => {
      if (disabled) localStorage.setItem("alchemy-disable-animations", "true");
      const timers = new TimerGroup();
      const game = vi.fn();
      const real = vi.fn();
      const waiting = vi.fn();
      timers.setGameTimeout(game, 500);
      timers.setTimeout(real, 500);
      const promise = delay(500).then(waiting);
      await vi.advanceTimersByTimeAsync(disabled ? 1 : 499);
      if (!disabled) {
        expect(game).not.toHaveBeenCalled();
        expect(waiting).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
      }
      expect(game).toHaveBeenCalledOnce();
      expect(waiting).toHaveBeenCalledOnce();
      expect(real).toHaveBeenCalledTimes(disabled ? 0 : 1);
      timers.clearAll();
      await vi.advanceTimersByTimeAsync(500);
      await promise;
      expect(real).toHaveBeenCalledTimes(disabled ? 0 : 1);
    },
  );
});
