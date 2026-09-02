import { describe, expect, it, vi } from "vitest";
import { runHandDrawSequence } from "@/features/alchemy/run-loop/battle/draw-sequence";
import { defaultBattleState } from "@/lib/battle";
import { makeTestCardWithId } from "../../../../fixtures/battle";
import { makeDrawSequenceDeps } from "./turn-orchestration-fixture";
import { installImmediateRafForTests } from "./battle-test-reset";

describe("runHandDrawSequence", () => {
  installImmediateRafForTests();

  it("returns false when the session is inactive", async () => {
    const applyState = vi.fn();
    const result = await runHandDrawSequence(
      [],
      { ...defaultBattleState(), hand: [makeTestCardWithId("slash", { uid: 1 })] },
      applyState,
      1,
      makeDrawSequenceDeps({ isSessionActive: () => false }),
    );
    expect(result).toBe(false);
    expect(applyState).not.toHaveBeenCalled();
  });

  it("applies state without animation when no new cards are drawn", async () => {
    const card = makeTestCardWithId("slash", { uid: 1 });
    const applyState = vi.fn();
    const deps = makeDrawSequenceDeps();
    const result = await runHandDrawSequence([card], { ...defaultBattleState(), hand: [card] }, applyState, 1, deps);

    expect(result).toBe(false);
    expect(applyState).toHaveBeenCalledOnce();
    expect(deps.setTransferInProgress).toHaveBeenCalledWith(false);
    expect(deps.setHiddenHandCardKeys).toHaveBeenCalledOnce();
    const clearHidden = vi.mocked(deps.setHiddenHandCardKeys).mock.calls[0]![0];
    expect([...clearHidden([])]).toEqual([]);
    expect(deps.animateDrawnHand).not.toHaveBeenCalled();
  });

  it("hides new cards, applies state, animates, then clears hidden keys", async () => {
    const oldHand = [makeTestCardWithId("slash", { uid: 1 })];
    const newHand = [makeTestCardWithId("slash", { uid: 1 }), makeTestCardWithId("block", { uid: 2 })];
    const applyState = vi.fn();
    const hiddenKeys: unknown[] = [];
    const deps = makeDrawSequenceDeps({
      setHiddenHandCardKeys: (update) => {
        hiddenKeys.push([...update([])]);
      },
    });

    const result = await runHandDrawSequence(oldHand, { ...defaultBattleState(), hand: newHand }, applyState, 3, deps);

    expect(result).toBe(true);
    expect(applyState).toHaveBeenCalledOnce();
    expect(deps.animateDrawnHand).toHaveBeenCalledWith([newHand[1]], newHand, 3);
    expect(deps.setTransferInProgress).toHaveBeenCalledWith(true);
    expect(deps.setTransferInProgress).toHaveBeenLastCalledWith(false);
    expect(hiddenKeys.length).toBeGreaterThan(0);
  });

  it("clears hidden keys even when the battle session ends mid-draw", async () => {
    const oldHand = [makeTestCardWithId("slash", { uid: 1 })];
    const newHand = [makeTestCardWithId("slash", { uid: 1 }), makeTestCardWithId("block", { uid: 2 })];
    const applyState = vi.fn();
    const hiddenKeys: unknown[] = [];
    let sessionActive = true;
    const deps = makeDrawSequenceDeps({
      isSessionActive: () => sessionActive,
      animateDrawnHand: vi.fn(async () => {
        sessionActive = false;
      }),
      setHiddenHandCardKeys: (update) => {
        hiddenKeys.push([...update(["slash-1", "block-2"])]);
      },
    });

    const result = await runHandDrawSequence(oldHand, { ...defaultBattleState(), hand: newHand }, applyState, 3, deps);

    expect(result).toBe(false);
    expect(deps.setTransferInProgress).toHaveBeenLastCalledWith(false);
    const lastHidden = hiddenKeys[hiddenKeys.length - 1] as string[];
    expect(lastHidden.includes("block-2")).toBe(false);
  });
});
