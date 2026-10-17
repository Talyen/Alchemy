import { afterEach, describe, expect, it, vi } from "vitest";
import { driveAutoplay } from "@/features/alchemy/run-loop/battle/autoplay-driver";
import * as animationPrefs from "@/lib/animation/animation-prefs";

function startAutoplay({ blocked = false, blockAfterPlay = false, postPlayDelayMs = 1000 } = {}) {
  vi.useFakeTimers();
  const controller = new AbortController();
  const wakeRef: { current: (() => void) | null } = { current: null };
  const state = { blocked };
  const play = vi.fn(() => {
    state.blocked = blockAfterPlay;
    return true;
  });
  const done = driveAutoplay({
    signal: controller.signal,
    delayMs: 100,
    postPlayDelayMs,
    wakeRef,
    isEnabled: () => true,
    findAction: () => (state.blocked ? null : { canCommit: () => !state.blocked, play }),
  });
  return { controller, wakeRef, state, play, done };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("autoplay scheduling", () => {
  it("bounds readiness and rejection retries even with animations disabled", async () => {
    vi.useFakeTimers();
    vi.spyOn(animationPrefs, "isAnimationDisabled").mockReturnValue(true);
    let blocked = true;
    let committed = false;
    const play = vi.fn(() => (committed = play.mock.calls.length > 1));
    const findAction = vi.fn(() => (blocked ? null : { canCommit: () => true, play }));
    const done = driveAutoplay({
      signal: new AbortController().signal,
      delayMs: 100,
      postPlayDelayMs: 0,
      isEnabled: () => !committed,
      findAction,
    });
    await vi.advanceTimersByTimeAsync(99);
    expect(findAction).toHaveBeenCalledOnce();
    blocked = false;
    await vi.advanceTimersByTimeAsync(1);
    expect(play).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(99);
    expect(play).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(play).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(animationPrefs.ANIMATION_DISABLED_DURATION);
    await done;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("revokes preview permission on ineligibility, disablement, and cancellation", async () => {
    const controller = new AbortController();
    let enabled = true;
    let eligible = true;
    await driveAutoplay({
      signal: controller.signal,
      delayMs: 0,
      postPlayDelayMs: 0,
      isEnabled: () => enabled,
      findAction: () => ({
        canCommit: () => eligible,
        play: async (control) => {
          await Promise.resolve();
          expect(control.signal).toBe(controller.signal);
          expect(control.canCommit()).toBe(true);
          eligible = false;
          expect(control.canCommit()).toBe(false);
          eligible = true;
          enabled = false;
          expect(control.canCommit()).toBe(false);
          enabled = true;
          controller.abort();
          expect(control.canCommit()).toBe(false);
          return false;
        },
      }),
    });
  });

  it("wakes readiness immediately without letting repeated wakes shorten pacing", async () => {
    const run = startAutoplay({ blocked: true });
    expect(run.play).not.toHaveBeenCalled();
    run.state.blocked = false;
    run.wakeRef.current?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(run.play).toHaveBeenCalledOnce();
    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(100);
      run.wakeRef.current?.();
    }
    await vi.advanceTimersByTimeAsync(699);
    expect(run.play).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(run.play).toHaveBeenCalledTimes(2);
    run.controller.abort();
    await run.done;
  });

  it.each([450, 1450])("counts a %s ms transfer toward pacing", async (transferMs) => {
    const run = startAutoplay({ blockAfterPlay: true });
    await vi.advanceTimersByTimeAsync(transferMs);
    expect(run.play).toHaveBeenCalledOnce();
    run.state.blocked = false;
    run.wakeRef.current?.();
    await vi.advanceTimersByTimeAsync(0);
    if (transferMs < 1000) {
      await vi.advanceTimersByTimeAsync(999 - transferMs);
      expect(run.play).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(1);
    }
    expect(run.play).toHaveBeenCalledTimes(2);
    run.controller.abort();
    await run.done;
  });

  it("rechecks a blocker introduced during pacing", async () => {
    const run = startAutoplay();
    await vi.advanceTimersByTimeAsync(250);
    run.state.blocked = true;
    await vi.advanceTimersByTimeAsync(1000);
    expect(run.play).toHaveBeenCalledOnce();
    run.state.blocked = false;
    run.wakeRef.current?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(run.play).toHaveBeenCalledTimes(2);
    run.controller.abort();
    await run.done;
  });

  it.each([false, true])("aborts cleanly while waiting for readiness=%s", async (blocked) => {
    const run = startAutoplay({ blockAfterPlay: blocked });
    await vi.advanceTimersByTimeAsync(blocked ? 1025 : 25);
    expect(vi.getTimerCount()).toBe(1);
    if (blocked) expect(run.wakeRef.current).toEqual(expect.any(Function));
    run.controller.abort();
    await run.done;
    expect(run.wakeRef.current).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(run.play).toHaveBeenCalledOnce();
  });

  it("preserves shortened pacing when animations are disabled", async () => {
    vi.spyOn(animationPrefs, "isAnimationDisabled").mockReturnValue(true);
    const run = startAutoplay();
    run.wakeRef.current?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(run.play).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(animationPrefs.ANIMATION_DISABLED_DURATION);
    expect(run.play).toHaveBeenCalledTimes(2);
    run.controller.abort();
    await run.done;
  });
});
