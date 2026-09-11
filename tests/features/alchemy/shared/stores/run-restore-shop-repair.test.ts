import "../../../../helpers/mock-audio";
import "../../../../helpers/mock-flush-save";
import { beforeEach, describe, expect, it } from "vitest";
import { readActivityData, shopItemSlotKey } from "@/lib/active-run-session";
import { restoreRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { readActiveRunScreen, readBattle, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { mutateGearForTest, resetAllTestStores, resetGearForTest } from "../../../../helpers/gameplay-store-test";
import { makeActiveRunData } from "./active-run-data-fixture";
import { cardById, trinketLibrary } from "@/lib/game-data";
import { evaluateSaveCandidates } from "@/features/alchemy/shared/storage/save-candidates";
import { makeMinimalActiveRunInput } from "../../../../fixtures/active-run";
import { makeTestBattleState } from "../../../../fixtures/battle";
const ownedTrinket = trinketLibrary[0]!;
const otherTrinket = trinketLibrary[1]!;

describe("saved battle card recovery", () => {
  beforeEach(() => {
    resetAllTestStores();
  });

  it.each(["opening-draw", "enemy-turn"] as const)(
    "restores card content in every pile and pending %s result",
    (kind) => {
      const card = cardById["molten-bulwark"]!;
      const damaged = {
        ...card,
        uid: 1,
        effects: [{ kind: "heal", amount: 9 }, { kind: "invalid" }],
        descriptionLines: ["Restore 9 Health", "Unknown action"],
        corrupted: true,
        corruptedValuePositions: [{ lineIndex: 0, matchIndex: 8 }],
      };
      const healthy = {
        ...card,
        uid: 2,
        cost: 0,
        effects: [{ kind: "heal", amount: 9 }],
        descriptionLines: ["Restore 9 Health"],
        corrupted: true,
        corruptedValuePositions: [{ lineIndex: 0, matchIndex: 8 }],
      };
      const cards = [damaged, healthy];
      const battleState = {
        ...makeTestBattleState(),
        deck: cards,
        hand: cards,
        discard: cards,
        exhausted: cards,
        wishOptions: cards,
        wishQueue: [cards],
      };
      const activeRun = makeMinimalActiveRunInput({
        currentScreen: "battle",
        runDeck: cards,
        activeCombat: {
          battleState,
          pendingBattleTransition: { kind, resultState: battleState, playerTurnSkipped: false },
        },
      });
      const loaded = evaluateSaveCandidates([JSON.stringify({ activeRun })]);
      expect(loaded.status.kind).toBe("ok");
      const reloaded = evaluateSaveCandidates([JSON.stringify(loaded.data)]);
      expect(reloaded.data.activeRun).not.toBeNull();
      if (!reloaded.data.activeRun) throw new Error("Expected restored active run");
      restoreRun(reloaded.data.activeRun, {}, {});
      const restored = readBattle();
      const transition = restored.pendingBattleTransition;
      if (!transition || !("resultState" in transition)) throw new Error("Expected pending battle result");
      const expected = [{ ...card, uid: 1 }, healthy];
      for (const state of [restored.battleState, transition.resultState]) {
        expect(state.deck).toEqual(expected);
        expect(state.hand).toEqual(expected);
        expect(state.discard).toEqual(expected);
        expect(state.exhausted).toEqual(expected);
        expect(state.wishOptions).toEqual(expected);
        expect(state.wishQueue).toEqual([expected]);
      }
    },
  );
});

describe("run restore shop offering repair", () => {
  beforeEach(() => {
    resetAllTestStores();
    resetGearForTest();
  });

  it("strips owned trinkets from a restored Trinket Shop and remaps purchased keys", () => {
    mutateGearForTest((gear) => gear.addTrinket(ownedTrinket.id));

    restoreRun(
      makeActiveRunData({
        currentScreen: "trinket-shop",
        trinketShopState: {
          trinketIds: [ownedTrinket.id, otherTrinket.id],
          refreshesLeft: 1,
          firstPurchaseUsed: true,
          purchasedSlotKeys: [shopItemSlotKey(otherTrinket.id, 1)],
        },
      }),
      {},
      {},
    );

    const shop = readActivityData(readRunSession().activity, "trinket-shop");
    expect(shop.trinkets.map((entry) => entry.id)).toEqual([otherTrinket.id]);
    expect(shop.purchasedSlotKeys).toEqual([shopItemSlotKey(otherTrinket.id, 0)]);
    expect(readActiveRunScreen()).toBe("trinket-shop");
  });

  it("leaves an exhausted restored Trinket Shop as a sold-out shelf", () => {
    mutateGearForTest((gear) => {
      gear.addTrinket(ownedTrinket.id);
      gear.addTrinket(otherTrinket.id);
    });

    restoreRun(
      makeActiveRunData({
        currentScreen: "trinket-shop",
        trinketShopState: {
          trinketIds: [ownedTrinket.id, otherTrinket.id],
          refreshesLeft: 0,
          firstPurchaseUsed: true,
          purchasedSlotKeys: [shopItemSlotKey(ownedTrinket.id, 0)],
        },
      }),
      {},
      {},
    );

    const shop = readActivityData(readRunSession().activity, "trinket-shop");
    expect(shop.trinkets).toEqual([]);
    expect(shop.purchasedSlotKeys).toEqual([]);
    expect(shop.refreshesLeft).toBe(0);
    expect(readActiveRunScreen()).toBe("trinket-shop");
  });

  it("strips owned unique gear from a restored Gear Shop", () => {
    const ownedUnique = { instanceId: "owned-wardbreaker", definitionId: "wardbreaker", affixes: [] };
    const shelfUnique = { instanceId: "shelf-wardbreaker", definitionId: "wardbreaker", affixes: [] };
    const shelfBasic = { instanceId: "shelf-basic", definitionId: "leather-armor-basic", affixes: [] };
    mutateGearForTest((gear) => gear.addInstance(ownedUnique, "knight"));

    restoreRun(
      makeActiveRunData({
        characterId: "knight",
        currentScreen: "equipment-shop",
        equipmentShopState: {
          gear: [shelfUnique, shelfBasic],
          refreshesLeft: 1,
          firstPurchaseUsed: true,
          purchasedSlotKeys: ["shelf-basic", "shelf-wardbreaker"],
        },
      }),
      {},
      {},
    );

    const shop = readActivityData(readRunSession().activity, "equipment-shop");
    expect(shop.gear.map((item) => item.instanceId)).toEqual(["shelf-basic"]);
    expect(shop.purchasedSlotKeys).toEqual(["shelf-basic"]);
  });
});
