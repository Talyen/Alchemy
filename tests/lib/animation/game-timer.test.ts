import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { delay, resolveGameDelay, TimerGroup } from "@/lib/animation/game-timer";

describe("game-timer", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  describe("resolveGameDelay", () => {
    it("returns original ms when animations are enabled", () => {
      expect(resolveGameDelay(500)).toBe(500);
      expect(resolveGameDelay(0)).toBe(0);
    });

    it("returns 1ms when animations are disabled", () => {
      localStorage.setItem("alchemy-disable-animations", "true");
      expect(resolveGameDelay(500)).toBe(1);
    });
  });

  describe("delay", () => {
    it("resolves after the specified duration", async () => {
      let resolved = false;
      const promise = delay(200).then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);
      vi.advanceTimersByTime(199);
      expect(resolved).toBe(false);
      vi.advanceTimersByTime(1);
      await promise;
      expect(resolved).toBe(true);
    });

    it("resolves in 1ms when animations are disabled", async () => {
      localStorage.setItem("alchemy-disable-animations", "true");
      let resolved = false;
      const promise = delay(1000).then(() => {
        resolved = true;
      });

      vi.advanceTimersByTime(1);
      await promise;
      expect(resolved).toBe(true);
    });
  });

  describe("TimerGroup", () => {
    it("schedules a timeout and executes the callback", () => {
      const timers = new TimerGroup();
      const fn = vi.fn();

      timers.setTimeout(fn, 100);
      expect(timers.size).toBe(1);

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledOnce();
      expect(timers.size).toBe(0);
    });

    it("allows canceling an individual scheduled timeout", () => {
      const timers = new TimerGroup();
      const fn = vi.fn();

      const cancel = timers.setTimeout(fn, 100);
      expect(timers.size).toBe(1);

      cancel();
      expect(timers.size).toBe(0);

      vi.advanceTimersByTime(100);
      expect(fn).not.toHaveBeenCalled();
    });

    it("setGameTimeout scales delay with resolveGameDelay", () => {
      localStorage.setItem("alchemy-disable-animations", "true");
      const timers = new TimerGroup();
      const fn = vi.fn();

      timers.setGameTimeout(fn, 500);
      vi.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalledOnce();
    });

    it("clearAll cancels all active timeouts in the group", () => {
      const timers = new TimerGroup();
      const fn1 = vi.fn();
      const fn2 = vi.fn();

      timers.setTimeout(fn1, 50);
      timers.setTimeout(fn2, 100);
      expect(timers.size).toBe(2);

      timers.clearAll();
      expect(timers.size).toBe(0);

      vi.advanceTimersByTime(200);
      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).not.toHaveBeenCalled();
    });
  });
});
