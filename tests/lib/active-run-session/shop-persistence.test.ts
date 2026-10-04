import { describe, expect, it } from "vitest";
import { hydrateEquipmentShopState, hydrateTrinketShopState, shopItemSlotKey } from "@/lib/active-run-session";
import { trinketLibrary } from "@/lib/game-data";
import { createGearInstance } from "@/lib/gear";
import { gearDefinitions } from "@/lib/gear/definitions";

const visit = { refreshesLeft: 1, freeRefreshUsed: true, firstPurchaseUsed: true };

describe("shop offer recovery", () => {
  it("remaps purchases after missing and inherited Trinket IDs are dropped", () => {
    const [a, b] = trinketLibrary;
    if (!a || !b) throw new Error("Trinket shop fixture is incomplete");
    const restored = hydrateTrinketShopState({
      ...visit,
      trinketIds: ["missing", a.id, "constructor", b.id, "toString"],
      purchasedSlotKeys: ["missing-0", shopItemSlotKey(b.id, 3), "toString-4"],
    });
    expect(restored).toEqual({
      ...visit,
      trinkets: [a, b],
      purchasedSlotKeys: [shopItemSlotKey(b.id, 1)],
    });
  });

  it("drops invalid Gear and its purchases while preserving live instance identity", () => {
    const instance = createGearInstance(gearDefinitions["leather-armor-basic"]);
    const original = {
      ...visit,
      gear: [
        { instanceId: "missing-item", definitionId: "missing", affixes: [] },
        { instanceId: "inherited-item", definitionId: "constructor", affixes: [] },
        instance,
      ],
      purchasedSlotKeys: ["missing-item", "inherited-item", instance.instanceId],
    };
    const before = structuredClone(original);
    expect(hydrateEquipmentShopState(original)).toEqual({
      ...visit,
      gear: [instance],
      purchasedSlotKeys: [instance.instanceId],
    });
    expect(original).toEqual(before);
    const restored = hydrateEquipmentShopState(original);
    expect(hydrateEquipmentShopState(restored)).toEqual(restored);
  });
});
