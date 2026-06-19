import { describe, expect, it } from "vitest";
import { resolveEquipSwap } from "@/features/alchemy/meta/screens/armory/resolve-equip-swap";
import { packInventoryWithPositions, type GearInstance } from "@/lib/gear";

describe("resolveEquipSwap", () => {
  const helmA: GearInstance = { instanceId: "helm-a", definitionId: "leather-helm-basic", affixes: [] };
  const helmB: GearInstance = { instanceId: "helm-b", definitionId: "leather-helm-basic", affixes: [] };

  it("returns canSwap false when the equipment slot is empty", () => {
    const inventory = [helmA];
    const packed = packInventoryWithPositions(inventory, 7, { [helmA.instanceId]: { col: 3, row: 2 } }).items;
    const inventoryById = new Map(inventory.map((item) => [item.instanceId, item]));

    expect(
      resolveEquipSwap({
        loadout: {
          body: null,
          helm: null,
          boots: null,
          gloves: null,
          belt: null,
          "main-hand": null,
          "off-hand": null,
          "left-ring": null,
          "right-ring": null,
          amulet: null,
        },
        slot: "helm",
        instance: helmA,
        vacatedPlacement: { col: 3, row: 2 },
        inventoryById,
        packedItems: packed,
      }),
    ).toEqual({ canSwap: false, displaced: null });
  });

  it("returns canSwap true when the displaced gear fits the vacated placement", () => {
    const inventory = [helmA, helmB];
    const packed = packInventoryWithPositions(inventory, 7, {
      [helmA.instanceId]: { col: 3, row: 2 },
      [helmB.instanceId]: { col: 1, row: 1 },
    }).items;
    const inventoryById = new Map(inventory.map((item) => [item.instanceId, item]));
    const loadout = {
      body: null,
      helm: helmB.instanceId,
      boots: null,
      gloves: null,
      belt: null,
      "main-hand": null,
      "off-hand": null,
      "left-ring": null,
      "right-ring": null,
      amulet: null,
    };

    expect(
      resolveEquipSwap({
        loadout,
        slot: "helm",
        instance: helmA,
        vacatedPlacement: { col: 3, row: 2 },
        inventoryById,
        packedItems: packed,
      }),
    ).toEqual({ canSwap: true, displaced: helmB });
  });

  it("returns canSwap false when the displaced footprint cannot fit the vacated cell", () => {
    const incomingBelt: GearInstance = { instanceId: "belt-in", definitionId: "leather-belt-basic", affixes: [] };
    const displacedHelm: GearInstance = { instanceId: "helm-b", definitionId: "leather-helm-basic", affixes: [] };
    const blockerHelm: GearInstance = { instanceId: "helm-c", definitionId: "leather-helm-basic", affixes: [] };
    const inventory = [incomingBelt, displacedHelm, blockerHelm];
    const packed = [
      { item: incomingBelt, col: 1, row: 1, w: 2, h: 1 },
      { item: blockerHelm, col: 2, row: 1, w: 2, h: 2 },
    ];
    const inventoryById = new Map(inventory.map((item) => [item.instanceId, item]));
    const loadout = {
      body: null,
      helm: displacedHelm.instanceId,
      boots: null,
      gloves: null,
      belt: null,
      "main-hand": null,
      "off-hand": null,
      "left-ring": null,
      "right-ring": null,
      amulet: null,
    };

    expect(
      resolveEquipSwap({
        loadout,
        slot: "helm",
        instance: incomingBelt,
        vacatedPlacement: { col: 1, row: 1 },
        inventoryById,
        packedItems: packed,
      }),
    ).toEqual({ canSwap: false, displaced: null });
  });
});
