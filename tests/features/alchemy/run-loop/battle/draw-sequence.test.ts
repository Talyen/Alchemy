import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { runHandDrawSequence, type HandDrawSequenceDeps } from "@/features/alchemy/run-loop/battle/draw-sequence";
import { defaultBattleState } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";

function makeCard(uid: number, id = "slash"): BattleCard {
  return { id, title: id, descriptionLines: [""], art: "", cost: 1, effects: [], uid };
}

function makeDeps(overrides: Partial<HandDrawSequenceDeps> = {}): HandDrawSequenceDeps {
  return {
    isSessionActive: () => true,
    animateDrawnHand: vi.fn(async () => {}),
    setTransferInProgress: vi.fn(),
    setHiddenHandCardKeys: vi.fn(),
    runIfSessionActive: (_session, action) => action(),
    ...overrides,
  };
}

describe("runHandDrawSequence", () => {
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

  it("returns false when the session is inactive", async () => {
    const applyState = vi.fn();
    const result = await runHandDrawSequence(
      [],
      { ...defaultBattleState(), hand: [makeCard(1)] },
      applyState,
      1,
      makeDeps({ isSessionActive: () => false }),
    );
    expect(result).toBe(false);
    expect(applyState).not.toHaveBeenCalled();
  });

  it("applies state without animation when no new cards are drawn", async () => {
    const card = makeCard(1);
    const applyState = vi.fn();
    const deps = makeDeps();
    const result = await runHandDrawSequence([card], { ...defaultBattleState(), hand: [card] }, applyState, 1, deps);

    expect(result).toBe(false);
    expect(applyState).toHaveBeenCalledOnce();
    expect(deps.setTransferInProgress).toHaveBeenCalledWith(false);
    expect(deps.animateDrawnHand).not.toHaveBeenCalled();
  });

  it("hides new cards, applies state, animates, then clears hidden keys", async () => {
    const oldHand = [makeCard(1)];
    const newHand = [makeCard(1), makeCard(2, "block")];
    const applyState = vi.fn();
    const hiddenKeys: unknown[] = [];
    const deps = makeDeps({
      setHiddenHandCardKeys: (update) => {
        hiddenKeys.push(typeof update === "function" ? update(new Set()) : update);
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
    const oldHand = [makeCard(1)];
    const newHand = [makeCard(1), makeCard(2, "block")];
    const applyState = vi.fn();
    const hiddenKeys: unknown[] = [];
    let sessionActive = true;
    const deps = makeDeps({
      isSessionActive: () => sessionActive,
      runIfSessionActive: (_session, action) => {
        if (sessionActive) action();
      },
      animateDrawnHand: vi.fn(async () => {
        sessionActive = false;
      }),
      setHiddenHandCardKeys: (update) => {
        hiddenKeys.push(typeof update === "function" ? update(new Set(["slash-1", "block-2"])) : update);
      },
    });

    const result = await runHandDrawSequence(oldHand, { ...defaultBattleState(), hand: newHand }, applyState, 3, deps);

    expect(result).toBe(false);
    expect(deps.setTransferInProgress).toHaveBeenLastCalledWith(false);
    const lastHidden = hiddenKeys[hiddenKeys.length - 1] as Set<string>;
    expect(lastHidden.has("block-2")).toBe(false);
  });
});
