import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyGearInventories, createEmptyGearLoadouts, equipGear, type GearInstance } from "@/lib/gear";
import { mutateGearForTest, resetGearForTest } from "../../../../helpers/run-domain-store-test";
import { readGearState } from "@/features/alchemy/shared/stores/gear-store";

const item: GearInstance = {
  instanceId: "crafted-sword",
  definitionId: "shortsword-basic",
  affixes: [{ id: "flat-physical", value: 1 }],
};

function initialize(itemToCraft = item, balance = 2) {
  resetGearForTest();
  const inventories = createEmptyGearInventories();
  inventories.knight = [itemToCraft];
  inventories.rogue = [{ ...item, instanceId: "rogues-sword" }];
  const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "main-hand", itemToCraft, [itemToCraft]);
  mutateGearForTest((gear) => gear.initialize(inventories, loadouts, { voidstone: balance }));
}

afterEach(resetGearForTest);

describe("gear crafting transactions", () => {
  it("changes only the owned item, charges once, and preserves equipment and previous snapshots", () => {
    initialize();
    const before = readGearState();
    const original = structuredClone(before);
    expect(mutateGearForTest((gear) => gear.applyCurrency("voidstone", item.instanceId, { rng: () => 0 }))).toBe(true);
    const after = readGearState();
    expect(after.inventories.knight).toEqual([{ ...item, affixes: [] }]);
    expect(after.inventories.rogue).toBe(before.inventories.rogue);
    expect(after.loadouts.knight["main-hand"]).toBe(item.instanceId);
    expect(after.craftingCurrencies.voidstone).toBe(1);
    expect(before).toEqual(original);

    const rng = vi.fn(() => 0);
    expect(mutateGearForTest((gear) => gear.applyCurrency("voidstone", item.instanceId, { rng }))).toBe(false);
    expect(readGearState()).toEqual(after);
    expect(rng).not.toHaveBeenCalled();
  });

  it.each(["unaffordable", "missing", "ineligible"] as const)(
    "rejects an %s craft without payment or RNG",
    (reason) => {
      initialize(reason === "ineligible" ? { ...item, affixes: [] } : item, reason === "unaffordable" ? 0 : 1);
      const before = structuredClone(readGearState());
      const rng = vi.fn(() => 0);
      expect(
        mutateGearForTest((gear) =>
          gear.applyCurrency("voidstone", reason === "missing" ? "absent" : item.instanceId, { rng }),
        ),
      ).toBe(false);
      expect(readGearState()).toEqual(before);
      expect(rng).not.toHaveBeenCalled();
    },
  );

  it("salvages equipped gear once, returns readable payouts, and preserves the other owner's inventory", () => {
    initialize();
    const before = readGearState();
    const original = structuredClone(before);
    const result = mutateGearForTest((gear) => gear.salvage(item.instanceId))!;
    const after = readGearState();
    expect(after.inventories.knight).toEqual([]);
    expect(after.inventories.rogue).toBe(before.inventories.rogue);
    expect(after.loadouts.knight["main-hand"]).toBeNull();
    expect(result.yieldedMaterials.iron).toBe(3);
    for (const [currency, amount] of Object.entries(result.yieldedCurrencies)) {
      expect(after.craftingCurrencies[currency as keyof typeof after.craftingCurrencies]).toBe(
        before.craftingCurrencies[currency as keyof typeof before.craftingCurrencies] + amount,
      );
    }
    expect(before).toEqual(original);
    expect(mutateGearForTest((gear) => gear.salvage(item.instanceId))).toBeNull();
    expect(readGearState()).toEqual(after);
  });
});
