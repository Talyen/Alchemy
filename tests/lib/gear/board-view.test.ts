import { describe, expect, it } from "vitest";
import { buildArmoryBoardView, createEmptyGearLoadouts, packInventoryWithPositions } from "@/lib/gear";

describe("packInventoryWithPositions", () => {
  it("reserves equipped item cells so visible inventory does not auto-pack into them", () => {
    const equipped = { instanceId: "equipped", definitionId: "leather-helm-basic" };
    const visible = { instanceId: "visible", definitionId: "leather-belt-basic" };
    const result = packInventoryWithPositions(
      [visible],
      4,
      {
        equipped: { col: 1, row: 1 },
        visible: { col: 3, row: 1 },
      },
      [equipped],
    );
    expect(result.items).toEqual([{ item: visible, col: 3, row: 1, w: 2, h: 1 }]);
  });
});

describe("buildArmoryBoardView", () => {
  it("builds a mixed armory board view with reserved equipment and active currencies", () => {
    const helm = { instanceId: "helm", definitionId: "leather-helm-basic", affixes: [] };
    const belt = { instanceId: "belt", definitionId: "leather-belt-basic", affixes: [] };
    const loadout = createEmptyGearLoadouts().knight;
    loadout.helm = helm.instanceId;

    const result = buildArmoryBoardView({
      inventory: [helm, belt],
      loadout,
      gearPositions: {
        helm: { col: 1, row: 1 },
        belt: { col: 1, row: 1 },
      },
      currencyPositions: {
        voidstone: { col: 5, row: 1 },
      },
      craftingCurrencies: {
        "discordant-dice": 0,
        "sprig-of-growth": 0,
        voidstone: 1,
        "ascension-seal": 0,
        "severance-maw": 0,
        "smiths-whetstone": 0,
      },
      cols: 8,
    });

    expect(result.activeCurrencyIds).toEqual(["voidstone"]);
    expect(result.availableInventory).toEqual([belt]);
    expect(result.packedInventory.items).toEqual([{ item: belt, col: 3, row: 1, w: 2, h: 1 }]);
    expect(result.packedCurrencies).toEqual([{ currencyId: "voidstone", col: 5, row: 1, w: 1, h: 1 }]);
    expect(result.boardObstacles.map((item) => item.item.instanceId)).toEqual(["belt", "voidstone"]);
    expect(result.occupiedRows).toBe(2);
  });
});
