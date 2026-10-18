import { describe, expect, it, vi } from "vitest";
import { animateDiscardedHand, animateDrawnHand } from "@/features/alchemy/run-loop/battle/card-transfer-animations";
import type { CardTransferAnimationDeps } from "@/features/alchemy/run-loop/battle/card-transfer-animations";
import { makeTestCardWithId } from "../../../../fixtures/battle";
import { installImmediateRafForTests } from "./battle-test-reset";
import { deferred } from "../../../../helpers/deferred";

const dockRect = { x: 0, y: 0, width: 40, height: 60 };
const handRect = { x: 100, y: 200, width: 80, height: 120 };

function makeDeps(overrides: Partial<CardTransferAnimationDeps> = {}): CardTransferAnimationDeps {
  return {
    isSessionActive: () => true,
    measureDrawPile: () => dockRect,
    measureDiscardPile: () => dockRect,
    measureHandCardRotation: () => null,
    measureHandCard: () => handRect,
    runCardTransfer: vi.fn(async () => {}),
    playTransferSound: vi.fn(),
    setHiddenHandCardKeys: vi.fn(),
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
  installImmediateRafForTests();

  it("returns early when the discard pile is missing", async () => {
    const deps = makeDeps({ measureDiscardPile: () => null });
    await animateDiscardedHand(
      [makeTestCardWithId("slash", { uid: 1 }), makeTestCardWithId("slash", { uid: 2 })],
      1,
      deps,
    );
    expect(deps.runCardTransfer).not.toHaveBeenCalled();
  });

  it("lands the flipped card at the discard pile without leaving the hand artwork visible", async () => {
    const deps = makeDeps();
    await animateDiscardedHand([makeTestCardWithId("slash", { uid: 1 })], 1, deps);
    const transfer = vi.mocked(deps.runCardTransfer).mock.calls[0]![0];
    expect(transfer.to.x + handRect.width / 2).toBe(dockRect.x + dockRect.width / 2);
    expect(transfer.to.y + handRect.height / 2).toBe(dockRect.y + dockRect.height / 2);
    expect(transfer.toScale).toBe(dockRect.width / handRect.width);
    expect(transfer.toScaleY).toBe(dockRect.height / handRect.height);
    expect(transfer.rotateY).toEqual([0, 180]);
    expect(deps.setHiddenHandCardKeys).toHaveBeenCalledOnce();
  });

  it("stops transferring when the session becomes inactive", async () => {
    let active = true;
    const deps = makeDeps({
      isSessionActive: () => active,
      runCardTransfer: vi.fn(async () => {
        active = false;
      }),
    });
    await animateDiscardedHand(
      [
        makeTestCardWithId("slash", { uid: 1 }),
        makeTestCardWithId("slash", { uid: 2 }),
        makeTestCardWithId("slash", { uid: 3 }),
      ],
      1,
      deps,
    );
    expect(deps.runCardTransfer).toHaveBeenCalledTimes(1);
  });
});

describe("animateDrawnHand", () => {
  installImmediateRafForTests();

  it("reveals only the transferred card after landing, preserving other hidden cards", async () => {
    const landing = deferred<void>();
    let hidden: readonly string[] = ["slash-1", "block-2", "anvil-3"];
    const deps = makeDeps({
      runCardTransfer: vi.fn(async (_transfer, onComplete) => {
        await landing.promise;
        onComplete?.();
      }),
      setHiddenHandCardKeys: (update) => {
        hidden = [...update(hidden)];
      },
    });
    const drawn = [makeTestCardWithId("block", { uid: 2 })];
    const hand = [makeTestCardWithId("slash", { uid: 1 }), ...drawn];

    const pending = animateDrawnHand(drawn, hand, 1, deps);
    await vi.waitFor(() => expect(deps.runCardTransfer).toHaveBeenCalledOnce());
    expect(deps.runCardTransfer).toHaveBeenCalledOnce();
    expect(hidden).toEqual(["slash-1", "block-2", "anvil-3"]);
    landing.resolve();
    await pending;
    expect(hidden).toEqual(["slash-1", "anvil-3"]);
  });
});
