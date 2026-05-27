import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { animateDiscardedHand, animateDrawnHand } from "@/features/alchemy/battle/card-transfer-animations";
import type { BattleCard } from "@/lib/game-data";
import type { CardTransferAnimationDeps } from "@/features/alchemy/battle/card-transfer-animations";

function makeCard(uid: number, id = "slash"): BattleCard {
  return { id, title: id, descriptionLines: [""], art: "", cost: 1, effects: [], uid };
}

const pileRect = { x: 0, y: 0, width: 40, height: 60 };
const handRect = { x: 100, y: 200, width: 80, height: 120 };

function makeDeps(overrides: Partial<CardTransferAnimationDeps> = {}): CardTransferAnimationDeps {
  return {
    isSessionActive: () => true,
    measureDiscardPile: () => pileRect,
    measureDrawPile: () => pileRect,
    measureHandCard: () => handRect,
    runCardTransfer: vi.fn(async () => {}),
    playTransferSound: vi.fn(),
    setHiddenHandCardKeys: vi.fn(),
    revealCardKey: vi.fn(),
    setCardPlayInProgress: vi.fn(),
    setTransferInProgress: vi.fn(),
    stableHandCardDeps: {
      measureHandCard: () => handRect,
      registerCancel: () => () => {},
      scheduleTimeout: () => () => {},
    },
    ...overrides,
  };
}

describe("animateDiscardedHand", () => {
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
  it("returns early when discard pile is missing", async () => {
    const deps = makeDeps({ measureDiscardPile: () => null });
    await animateDiscardedHand([makeCard(1), makeCard(2)], 1, deps);
    expect(deps.runCardTransfer).not.toHaveBeenCalled();
  });

  it("discards from the end of the hand first", async () => {
    const deps = makeDeps();
    const cards = [makeCard(1, "a"), makeCard(2, "b"), makeCard(3, "c")];
    await animateDiscardedHand(cards, 1, deps);

    const transferred = vi.mocked(deps.runCardTransfer).mock.calls.map((call) => call[0].card.id);
    expect(transferred).toEqual(["c", "b", "a"]);
  });

  it("stops transferring when the session becomes inactive", async () => {
    let active = true;
    const deps = makeDeps({
      isSessionActive: () => active,
      runCardTransfer: vi.fn(async () => {
        active = false;
      }),
    });
    await animateDiscardedHand([makeCard(1), makeCard(2), makeCard(3)], 1, deps);
    expect(deps.runCardTransfer).toHaveBeenCalledTimes(1);
  });
});

describe("animateDrawnHand", () => {
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

  it("reveals each drawn card after transfer completes", async () => {
    const deps = makeDeps({
      runCardTransfer: vi.fn(async (_transfer, onComplete) => {
        onComplete?.();
      }),
    });
    const drawn = [makeCard(2, "block")];
    const hand = [makeCard(1), ...drawn];

    await animateDrawnHand(drawn, hand, 1, deps);

    expect(deps.revealCardKey).toHaveBeenCalledWith("block-2");
    expect(deps.setHiddenHandCardKeys).toHaveBeenCalled();
  });
});
