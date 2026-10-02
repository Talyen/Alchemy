import { afterEach, describe, expect, it, vi } from "vitest";
import { driveAutoplay } from "@/features/alchemy/run-loop/battle/autoplay-driver";
import * as animationPrefs from "@/lib/animation/animation-prefs";
import { playableCard } from "./open-battle-fixture";

describe("driveAutoplay", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("runs ready actions in sequence until disabled", async () => {
    const played: number[] = [];
    await driveAutoplay({
      signal: new AbortController().signal,
      delayMs: 0,
      postPlayDelayMs: 0,
      isEnabled: () => played.length < 2,
      findAction: () => ({
        canCommit: () => true,
        play: () => {
          played.push(played.length + 1);
          return true;
        },
      }),
    });
    expect(played).toEqual([1, 2]);
  });

  it("retries a rejected action instead of stopping", async () => {
    let committed = false;
    const play = vi.fn(() => {
      committed = play.mock.calls.length > 1;
      return committed;
    });
    await driveAutoplay({
      signal: new AbortController().signal,
      delayMs: 0,
      postPlayDelayMs: 0,
      isEnabled: () => !committed,
      findAction: () => ({ canCommit: () => true, play }),
    });
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("rechecks eligibility, enablement, and cancellation during an action preview", async () => {
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

  it("waits the post-play delay before playing the next card", async () => {
    vi.useFakeTimers();
    const playable = [
      { ...playableCard, uid: 1 },
      { ...playableCard, uid: 2 },
    ];
    const played: number[] = [];
    const controller = new AbortController();

    const done = driveAutoplay({
      signal: controller.signal,
      delayMs: 0,
      postPlayDelayMs: 1000,
      isEnabled: () => played.length < playable.length,
      findAction: () => {
        const card = playable.find((item) => !played.includes(item.uid));
        return card
          ? {
              canCommit: () => true,
              play: () => {
                played.push(card.uid);
                return true;
              },
            }
          : null;
      },
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(played).toEqual([1]);

    await vi.advanceTimersByTimeAsync(999);
    expect(played).toEqual([1]);

    await vi.advanceTimersByTimeAsync(1);
    expect(played).toEqual([1, 2]);

    await vi.advanceTimersByTimeAsync(1000);
    await done;
  });

  it("short-circuits a retry wait when wakeRef fires", async () => {
    vi.useFakeTimers();
    const wakeRef: { current: (() => void) | null } = { current: null };
    let blocked = true;
    const played: number[] = [];
    const controller = new AbortController();

    const done = driveAutoplay({
      signal: controller.signal,
      delayMs: 1000,
      postPlayDelayMs: 0,
      wakeRef,
      isEnabled: () => played.length < 1,
      findAction: () =>
        blocked
          ? null
          : {
              canCommit: () => !blocked,
              play: () => {
                played.push(1);
                return true;
              },
            },
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(played).toEqual([]);
    expect(wakeRef.current).toEqual(expect.any(Function));

    blocked = false;
    await Promise.resolve();
    wakeRef.current?.();
    await vi.advanceTimersByTimeAsync(0);

    expect(played).toEqual([1]);
    controller.abort();
    await done;
  });

  function startTimedAutoplay(blockedAfterPlay = false) {
    vi.useFakeTimers();
    const controller = new AbortController();
    const wakeRef: { current: (() => void) | null } = { current: null };
    const state = { blocked: false };
    const playCard = vi.fn(() => {
      state.blocked = blockedAfterPlay;
      return true;
    });
    const done = driveAutoplay({
      signal: controller.signal,
      delayMs: 100,
      postPlayDelayMs: 1000,
      wakeRef,
      isEnabled: () => true,
      findAction: () => (state.blocked ? null : { canCommit: () => !state.blocked, play: playCard }),
    });
    return { controller, wakeRef, state, playCard, done };
  }

  it.each([1, 3])("preserves pacing through %s wake notifications", async (wakeCount) => {
    const run = startTimedAutoplay();
    for (let i = 0; i < wakeCount; i++) {
      await vi.advanceTimersByTimeAsync(100);
      run.wakeRef.current?.();
      await vi.advanceTimersByTimeAsync(0);
      expect(run.playCard).toHaveBeenCalledOnce();
    }
    await vi.advanceTimersByTimeAsync(999 - wakeCount * 100);
    expect(run.playCard).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(run.playCard).toHaveBeenCalledTimes(2);
    run.controller.abort();
    await run.done;
  });

  it.each([450, 1450])("counts a %s ms transfer toward the post-play delay", async (transferMs) => {
    const run = startTimedAutoplay(true);
    await vi.advanceTimersByTimeAsync(transferMs);
    expect(run.playCard).toHaveBeenCalledOnce();
    run.state.blocked = false;
    run.wakeRef.current?.();
    await vi.advanceTimersByTimeAsync(0);
    if (transferMs < 1000) {
      await vi.advanceTimersByTimeAsync(999 - transferMs);
      expect(run.playCard).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(1);
    }
    expect(run.playCard).toHaveBeenCalledTimes(2);
    run.controller.abort();
    await run.done;
  });

  it("rechecks a blocker introduced during the pacing pause", async () => {
    const run = startTimedAutoplay();
    await vi.advanceTimersByTimeAsync(250);
    run.state.blocked = true;
    run.wakeRef.current?.();
    await vi.advanceTimersByTimeAsync(1000);
    expect(run.playCard).toHaveBeenCalledOnce();
    run.state.blocked = false;
    run.wakeRef.current?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(run.playCard).toHaveBeenCalledTimes(2);
    run.controller.abort();
    await run.done;
  });

  it.each([false, true])("cleans up an aborted wait (waiting for readiness: %s)", async (blocked) => {
    const run = startTimedAutoplay(blocked);
    await vi.advanceTimersByTimeAsync(blocked ? 1025 : 25);
    expect(vi.getTimerCount()).toBe(1);
    if (blocked) expect(run.wakeRef.current).toEqual(expect.any(Function));
    run.controller.abort();
    await run.done;
    expect(run.wakeRef.current).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(run.playCard).toHaveBeenCalledOnce();
  });

  it("preserves shortened pacing when animations are disabled", async () => {
    vi.spyOn(animationPrefs, "isAnimationDisabled").mockReturnValue(true);
    const run = startTimedAutoplay();
    run.wakeRef.current?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(run.playCard).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(animationPrefs.ANIMATION_DISABLED_DURATION);
    expect(run.playCard).toHaveBeenCalledTimes(2);
    run.controller.abort();
    await run.done;
  });
});
