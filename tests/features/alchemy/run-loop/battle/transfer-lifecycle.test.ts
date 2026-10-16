import { describe, expect, it, vi } from "vitest";
import { PlaybackLifetime } from "@/features/alchemy/run-loop/battle/playback-lifetime";
import { runPlaybackTask } from "@/features/alchemy/run-loop/battle/playback-task";

describe("PlaybackLifetime", () => {
  it.each(["beginAction", "finish"] as const)(
    "does not let %s overwrite a replacement from an autoplay cleanup",
    (operation) => {
      const lifetime = new PlaybackLifetime();
      let replace = false;
      lifetime.bind({
        scheduleAutoEndTurn: () => {},
        clearAutoEndTurn: () => {
          if (!replace) return;
          replace = false;
          lifetime.restart();
          lifetime.beginOpening(lifetime.id);
          lifetime.beginDraw(lifetime.id, "card");
        },
      });
      const old = lifetime.id;
      replace = true;
      const admitted = lifetime[operation](old);
      expect(lifetime.isCurrent(old)).toBe(false);
      expect(lifetime.cardPlayInProgress).toBe(true);
      expect(lifetime.finishing).toBe(false);
      expect(lifetime.canAcceptInput(true)).toBe(false);
      expect(admitted).toBe(false);
      lifetime.completeAction(lifetime.id);
      expect(lifetime.canAcceptInput()).toBe(true);
      expect(lifetime[operation](old)).toBe(false);
      expect(lifetime.canAcceptInput()).toBe(true);
    },
  );

  it("rejects phase admission revoked by a playback observer and preserves replacement timers", () => {
    vi.useFakeTimers();
    try {
      const lifetime = new PlaybackLifetime();
      const old = lifetime.id;
      const replacement = vi.fn();
      lifetime.subscribe(() => {
        if (!lifetime.isCurrent(old) || !lifetime.cardPlayInProgress) return;
        lifetime.restart();
        lifetime.capture(lifetime.id).setTimeout(replacement, 10);
      });
      expect(lifetime.beginAction(old)).toBe(false);
      lifetime.clearTimers(old);
      expect(lifetime.canAcceptInput()).toBe(true);
      vi.runAllTimers();
      expect(replacement).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("retains the newest autoplay binding when old cleanup binds reentrantly", () => {
    const lifetime = new PlaybackLifetime();
    const newer = { scheduleAutoEndTurn: vi.fn(), clearAutoEndTurn: () => {} };
    const older = { scheduleAutoEndTurn: vi.fn(), clearAutoEndTurn: () => {} };
    let replace = false;
    lifetime.bind({
      scheduleAutoEndTurn: () => {},
      clearAutoEndTurn: () => {
        if (!replace) return;
        replace = false;
        lifetime.bind(newer);
      },
    });
    replace = true;
    lifetime.bind(older);
    lifetime.scheduleAutoEndTurn();
    expect(newer.scheduleAutoEndTurn).toHaveBeenCalledOnce();
    expect(older.scheduleAutoEndTurn).not.toHaveBeenCalled();
  });

  it("releases the old generation before an observer starts its replacement", () => {
    vi.useFakeTimers();
    try {
      const lifetime = new PlaybackLifetime();
      const signal = lifetime.signal;
      const old = lifetime.id;
      lifetime.beginDraw(old);
      const oldTimer = vi.fn();
      const newTimer = vi.fn();
      lifetime.capture(old).setTimeout(oldTimer, 10);
      let restarted = false;
      lifetime.subscribe(() => {
        if (restarted || lifetime.isCurrent(old)) return;
        restarted = true;
        expect(signal.aborted).toBe(true);
        expect(lifetime.pendingDraws).toBe(0);
        expect(lifetime.pendingTimers).toBe(0);
        lifetime.restart();
        lifetime.capture(lifetime.id).setTimeout(newTimer, 10);
      });
      lifetime.restart();
      expect(restarted).toBe(true);
      expect(lifetime.id).toBe(old + 1);
      vi.runAllTimers();
      expect(oldTimer).not.toHaveBeenCalled();
      expect(newTimer).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
  it("finishes cancellation despite failed observers, transfer cleanup, and autoplay adapters", async () => {
    vi.useFakeTimers();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const lifetime = new PlaybackLifetime();
      const old = lifetime.id;
      const signal = lifetime.signal;
      lifetime.beginDraw(old);
      lifetime.bind({
        scheduleAutoEndTurn: () => {},
        clearAutoEndTurn: () => {
          throw new Error("autoplay");
        },
      });
      lifetime.subscribe(() => {
        throw new Error("observer");
      });
      lifetime.registerCancel(() => {
        throw new Error("transfer");
      });
      const waiting = runPlaybackTask(
        lifetime.capture(old).registerCancel,
        () => false,
        () => {},
      );
      const timer = vi.fn();
      lifetime.capture(old).setTimeout(timer, 10);
      expect(() => lifetime.restart()).not.toThrow();
      await expect(waiting).resolves.toBe(false);
      expect(signal.aborted).toBe(true);
      expect(lifetime.pendingDraws).toBe(0);
      expect(lifetime.isCurrent(old)).toBe(false);
      expect(lifetime.canAcceptInput()).toBe(true);
      vi.runAllTimers();
      expect(timer).not.toHaveBeenCalled();
    } finally {
      errors.mockRestore();
      vi.useRealTimers();
    }
  });
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

  it("revokes retained scheduling and cancellation hooks when a battle is replaced", async () => {
    vi.useFakeTimers();
    try {
      const lifetime = new PlaybackLifetime();
      const oldScope = lifetime.capture(lifetime.id);
      const unadmittedScope = lifetime.capture(lifetime.id + 1);
      const staleEffect = vi.fn();
      oldScope.setTimeout(staleEffect, 10);
      lifetime.restart();
      const currentScope = lifetime.capture(lifetime.id);
      const currentEffect = vi.fn();
      currentScope.setTimeout(currentEffect, 10);
      unadmittedScope.setTimeout(staleEffect, 10);
      oldScope.setGameTimeout(staleEffect, 10);
      oldScope.setTimeout(staleEffect, 10);
      const cancelled = vi.fn();
      oldScope.registerCancel(cancelled);
      expect(cancelled).toHaveBeenCalledOnce();
      expect(lifetime.pendingTimers).toBe(1);
      await vi.runAllTimersAsync();
      expect(staleEffect).not.toHaveBeenCalled();
      expect(currentEffect).toHaveBeenCalledOnce();
      lifetime.cancel();
      expect(cancelled).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
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
    lifetime.capture(lifetime.id).setTimeout(timer, 10);
    expect(lifetime.finish(lifetime.id)).toBe(true);
    expect(lifetime.finish(lifetime.id)).toBe(false);
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
    expect(lifetime.finish(lifetime.id)).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});
