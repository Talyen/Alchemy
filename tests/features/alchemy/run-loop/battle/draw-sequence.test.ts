import { clearBattleStageMarks, battleStageMarkName } from "@/lib/performance/battle-stage-marks";
import { describe, expect, it, vi } from "vitest";
import { PlaybackLifetime } from "@/features/alchemy/run-loop/battle/playback-lifetime";
import { runHandDrawSequence } from "@/features/alchemy/run-loop/battle/draw-sequence";
import { defaultBattleState } from "@/lib/battle";
import { makeTestCardWithId } from "../../../../fixtures/battle";
import { makeDrawSequenceDeps } from "./turn-orchestration-fixture";
import { installImmediateRafForTests } from "./battle-test-reset";

describe("runHandDrawSequence", () => {
  installImmediateRafForTests();

  it("returns false when the session is inactive", async () => {
    const onReveal = vi.fn();
    const result = await runHandDrawSequence(
      [],
      { ...defaultBattleState(), hand: [makeTestCardWithId("slash", { uid: 1 })] },
      onReveal,
      1,
      makeDrawSequenceDeps({ isSessionActive: () => false }),
    );
    expect(result).toBe(false);
    expect(onReveal).not.toHaveBeenCalled();
  });

  it("applies state without animation when no new cards are drawn", async () => {
    const card = makeTestCardWithId("slash", { uid: 1 });
    const onReveal = vi.fn();
    const deps = makeDrawSequenceDeps();
    const result = await runHandDrawSequence([card], { ...defaultBattleState(), hand: [card] }, onReveal, 1, deps);

    expect(result).toBe(false);
    expect(onReveal).toHaveBeenCalledOnce();
    expect(deps.setTransferInProgress).not.toHaveBeenCalled();
    expect(deps.setHiddenHandCardKeys).not.toHaveBeenCalled();
    expect(deps.animateDrawnHand).not.toHaveBeenCalled();
  });

  it("hides new cards, applies state, animates, then clears hidden keys", async () => {
    const oldHand = [makeTestCardWithId("slash", { uid: 1 })];
    const newHand = [makeTestCardWithId("slash", { uid: 1 }), makeTestCardWithId("block", { uid: 2 })];
    const onReveal = vi.fn();
    const hiddenKeys: unknown[] = [];
    const deps = makeDrawSequenceDeps({
      setHiddenHandCardKeys: (update) => {
        hiddenKeys.push([...update([])]);
      },
    });

    const result = await runHandDrawSequence(oldHand, { ...defaultBattleState(), hand: newHand }, onReveal, 3, deps);

    expect(result).toBe(true);
    expect(onReveal).toHaveBeenCalledOnce();
    expect(deps.animateDrawnHand).toHaveBeenCalledWith([newHand[1]], newHand, 3);
    expect(deps.setTransferInProgress).toHaveBeenCalledWith(true);
    expect(deps.setTransferInProgress).toHaveBeenLastCalledWith(false);
    expect(hiddenKeys.length).toBeGreaterThan(0);
  });

  it("shares draw ownership across copied dependencies and preserves overlapping draws", async () => {
    let hidden: string[] = [];
    const finish: Array<() => void> = [];
    const deps = makeDrawSequenceDeps({
      setHiddenHandCardKeys: (update) => {
        hidden = [...update(hidden)];
      },
      animateDrawnHand: () =>
        new Promise<void>((resolve) => {
          finish.push(resolve);
        }),
    });
    const first = makeTestCardWithId("slash", { uid: 1 });
    const second = makeTestCardWithId("block", { uid: 2 });
    const state = { ...defaultBattleState(), hand: [first] };
    const firstDraw = runHandDrawSequence([], state, () => {}, 1, deps);
    const secondDraw = runHandDrawSequence([first], { ...state, hand: [first, second] }, () => {}, 1, {
      ...deps,
      isSessionActive: () => true,
    });
    await vi.waitFor(() => expect(finish).toHaveLength(2));
    await runHandDrawSequence([first], state, () => {}, 1, deps);
    expect(hidden).toEqual(["slash-1", "block-2"]);
    finish[0]!();
    await firstDraw;
    expect(hidden).toEqual(["block-2"]);
    expect(deps.setTransferInProgress).toHaveBeenLastCalledWith(true);
    finish[1]!();
    await secondDraw;
    expect(hidden).toEqual([]);
    expect(deps.setTransferInProgress).toHaveBeenLastCalledWith(false);
  });

  it("releases draw ownership and hidden cards when animation fails", async () => {
    let hidden: string[] = [];
    const deps = makeDrawSequenceDeps({
      animateDrawnHand: async () => {
        throw new Error("animation failed");
      },
      setHiddenHandCardKeys: (update) => {
        hidden = [...update(hidden)];
      },
    });
    await expect(
      runHandDrawSequence(
        [],
        { ...defaultBattleState(), hand: [makeTestCardWithId("slash", { uid: 1 })] },
        () => {},
        1,
        deps,
      ),
    ).rejects.toThrow("animation failed");
    expect(deps.playback.pendingDraws).toBe(0);
    expect(hidden).toEqual([]);
    expect(deps.setTransferInProgress).toHaveBeenLastCalledWith(false);
  });

  it("settles a cancelled draw before its frame arrives and preserves the new battle", async () => {
    const playback = new PlaybackLifetime();
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return 42;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    try {
      const deps = makeDrawSequenceDeps({ playback, isSessionActive: (id) => playback.isCurrent(id) });
      const drawing = runHandDrawSequence(
        [],
        { ...defaultBattleState(), hand: [makeTestCardWithId("slash", { uid: 1 })] },
        () => {},
        playback.id,
        deps,
      );
      expect(playback.pendingDraws).toBe(1);
      playback.restart();
      const finishNewDraw = playback.beginDraw(playback.id);
      await expect(drawing).resolves.toBe(false);
      callbacks[0]!(0);
      expect(playback.pendingDraws).toBe(1);
      expect(deps.animateDrawnHand).not.toHaveBeenCalled();
      expect(deps.setHiddenHandCardKeys).toHaveBeenCalledOnce();
      finishNewDraw();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not mutate presentation when the battle session ends mid-draw", async () => {
    const oldHand = [makeTestCardWithId("slash", { uid: 1 })];
    const newHand = [makeTestCardWithId("slash", { uid: 1 }), makeTestCardWithId("block", { uid: 2 })];
    const onReveal = vi.fn();
    const hiddenKeys: unknown[] = [];
    let sessionActive = true;
    const deps = makeDrawSequenceDeps({
      isSessionActive: () => sessionActive,
      animateDrawnHand: vi.fn(async () => {
        sessionActive = false;
        clearBattleStageMarks();
      }),
      setHiddenHandCardKeys: (update) => {
        hiddenKeys.push([...update(["slash-1", "block-2"])]);
      },
    });

    const result = await runHandDrawSequence(oldHand, { ...defaultBattleState(), hand: newHand }, onReveal, 3, deps);

    expect(result).toBe(false);
    expect(performance.getEntriesByName(battleStageMarkName("draw-end"), "mark")).toHaveLength(0);
    expect(deps.setTransferInProgress).toHaveBeenLastCalledWith(true);
    expect(hiddenKeys).toHaveLength(1);
    const lastHidden = hiddenKeys[hiddenKeys.length - 1] as string[];
    expect(lastHidden.includes("block-2")).toBe(true);
  });
});
