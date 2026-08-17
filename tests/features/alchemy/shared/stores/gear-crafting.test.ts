import { describe, expect, it } from "vitest";
import { type GearInstance, createEmptyGearInventories, createEmptyGearLoadouts, equipGear } from "@/lib/gear";
import { useGearStore } from "../../../../helpers/gameplay-store-test";

function knightInventories(...items: GearInstance[]) {
  const inventories = createEmptyGearInventories();
  inventories.knight = items;
  return inventories;
}

describe("gear-store crafting integration", () => {
  const item: GearInstance = {
    instanceId: "test-item-1",
    definitionId: "shortsword-basic",
    affixes: [{ id: "flat-physical", value: 1 }],
  };

  it("initializes crafting currencies, merging defaults", () => {
    useGearStore.getState().reset();
    useGearStore.getState().initialize(knightInventories(item), createEmptyGearLoadouts(), { "discordant-dice": 3 });

    expect(useGearStore.getState().craftingCurrencies["discordant-dice"]).toBe(3);
    expect(useGearStore.getState().craftingCurrencies["sprig-of-growth"]).toBe(0);
    useGearStore.getState().reset();
  });

  it("adds currencies using addCurrencies action", () => {
    useGearStore.getState().reset();
    useGearStore.getState().addCurrencies({ "discordant-dice": 5, "sprig-of-growth": 2 });

    expect(useGearStore.getState().craftingCurrencies["discordant-dice"]).toBe(5);
    expect(useGearStore.getState().craftingCurrencies["sprig-of-growth"]).toBe(2);
    useGearStore.getState().reset();
  });

  it("updates crafting currencies on gear salvage", () => {
    useGearStore.getState().reset();
    useGearStore.getState().initialize(knightInventories(item), createEmptyGearLoadouts());

    expect(useGearStore.getState().craftingCurrencies["discordant-dice"]).toBe(0);

    const salvageResult = useGearStore.getState().salvage(item.instanceId, { rng: () => 0 });
    expect(salvageResult).toBeDefined();
    expect(salvageResult?.inventories.knight).toEqual([]);
    expect(salvageResult?.yieldedMaterials.iron).toBe(3);
    expect(useGearStore.getState().craftingCurrencies["discordant-dice"]).toBe(1);
    useGearStore.getState().reset();
  });

  it("applies currency to equipped gear without clearing loadout references", () => {
    useGearStore.getState().reset();
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "main-hand", item, [item]);
    useGearStore.getState().initialize(knightInventories(item), loadouts, { voidstone: 1 });

    const successApply = useGearStore.getState().applyCurrency("voidstone", item.instanceId, { rng: () => 0 });
    expect(successApply).toBe(true);
    expect(useGearStore.getState().craftingCurrencies.voidstone).toBe(0);
    expect(useGearStore.getState().loadouts.knight["main-hand"]).toBe(item.instanceId);
    expect(
      useGearStore.getState().inventories.knight.find((i) => i.instanceId === item.instanceId)?.affixes,
    ).toHaveLength(0);
    useGearStore.getState().reset();
  });

  it("salvages equipped gear and clears loadout references", () => {
    useGearStore.getState().reset();
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "main-hand", item, [item]);
    useGearStore.getState().initialize(knightInventories(item), loadouts);

    const salvageResult = useGearStore.getState().salvage(item.instanceId, { rng: () => 0 });
    expect(salvageResult?.inventories.knight).toEqual([]);
    expect(useGearStore.getState().loadouts.knight["main-hand"]).toBeNull();
    useGearStore.getState().reset();
  });

  describe("applyCurrency store integration", () => {
    const rng = () => 0;

    function initStore(inventory: GearInstance[], currencies: Partial<Record<string, number>>) {
      useGearStore.getState().reset();
      useGearStore.getState().initialize(knightInventories(...inventory), createEmptyGearLoadouts(), currencies);
    }

    it.each([
      {
        currencyId: "discordant-dice" as const,
        item: {
          instanceId: "dice-item",
          definitionId: "shortsword-basic" as const,
          affixes: [
            { id: "flat-physical" as const, value: 1 },
            { id: "flat-stun" as const, value: 1 },
          ],
        },
      },
      {
        currencyId: "sprig-of-growth" as const,
        item: {
          instanceId: "sprig-item",
          definitionId: "shortsword-basic" as const,
          affixes: [{ id: "flat-physical" as const, value: 1 }],
        },
      },
      {
        currencyId: "ascension-seal" as const,
        item: {
          instanceId: "seal-item",
          definitionId: "leather-armor-basic" as const,
          affixes: [{ id: "max-health" as const, value: 7 }],
        },
      },
      {
        currencyId: "severance-maw" as const,
        item: {
          instanceId: "maw-item",
          definitionId: "shortsword-basic" as const,
          affixes: [
            { id: "flat-physical" as const, value: 1 },
            { id: "flat-stun" as const, value: 1 },
          ],
        },
      },
      {
        currencyId: "smiths-whetstone" as const,
        item: {
          instanceId: "whetstone-item",
          definitionId: "shortsword-basic" as const,
          affixes: [
            { id: "flat-physical" as const, value: 2 },
            { id: "flat-stun" as const, value: 1 },
          ],
        },
      },
    ])("spends $currencyId through the store", ({ currencyId, item }) => {
      initStore([item], { [currencyId]: 1 });
      const success = useGearStore.getState().applyCurrency(currencyId, item.instanceId, { rng });
      expect(success).toBe(true);
      expect(useGearStore.getState().craftingCurrencies[currencyId]).toBe(0);
      useGearStore.getState().reset();
    });

    it("returns false when currency count is zero", () => {
      initStore([item], { voidstone: 0 });
      expect(useGearStore.getState().applyCurrency("voidstone", item.instanceId)).toBe(false);
      expect(useGearStore.getState().craftingCurrencies.voidstone).toBe(0);
      useGearStore.getState().reset();
    });

    it("returns false and does not spend currency on ineligible targets", () => {
      const bareItem: GearInstance = {
        instanceId: "bare-item",
        definitionId: "leather-armor-basic",
        affixes: [],
      };
      initStore([bareItem], { voidstone: 1 });
      expect(useGearStore.getState().applyCurrency("voidstone", bareItem.instanceId)).toBe(false);
      expect(useGearStore.getState().craftingCurrencies.voidstone).toBe(1);
      expect(useGearStore.getState().inventories.knight[0]?.affixes).toEqual([]);
      useGearStore.getState().reset();
    });
  });
});
