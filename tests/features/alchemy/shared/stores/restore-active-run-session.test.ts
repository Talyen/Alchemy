import "../../../../helpers/mock-audio";
import "../../../../helpers/mock-flush-save";
import { beforeEach, describe, expect, it } from "vitest";
import { shopItemSlotKey } from "@/lib/active-run-session";
import { restoreRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { readActiveRunScreen, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { mutateGearForTest, resetAllTestStores, resetGearForTest } from "../../../../helpers/gameplay-store-test";
import { makeActiveRunData } from "./active-run-data-fixture";
import { trinketLibrary } from "@/lib/game-data";

const ownedTrinket = trinketLibrary[0]!;
const otherTrinket = trinketLibrary[1]!;

describe("restoreRunSession shop offering repair", () => {
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

    const shop = readRunSession().trinketShopState;
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

    const shop = readRunSession().trinketShopState;
    expect(shop.trinkets).toEqual([]);
    expect(shop.purchasedSlotKeys).toEqual([]);
    expect(shop.refreshesLeft).toBe(0);
    expect(readActiveRunScreen()).toBe("trinket-shop");
  });

  it("strips owned unique gear from a restored Equipment Shop", () => {
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

    const shop = readRunSession().equipmentShopState;
    expect(shop.gear.map((item) => item.instanceId)).toEqual(["shelf-basic"]);
    expect(shop.purchasedSlotKeys).toEqual(["shelf-basic"]);
  });
});
