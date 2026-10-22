import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyGearInventories, createEmptyGearLoadouts, equipGear, type GearInstance } from "@/lib/gear";
import { mutateGearForTest, resetGearForTest } from "../../../../../helpers/run-domain-store-test";
import { readGearState } from "@/features/alchemy/shared/stores/session/gear-store";
import { salvageGear } from "@/features/alchemy/shared/stores/commands/gear-commands";
import { defaultGameSession } from "@/app/application-session";

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
    const before = readGearState(defaultGameSession);
    const original = structuredClone(before);
    expect(mutateGearForTest((gear) => gear.applyCurrency("voidstone", item.instanceId, { rng: () => 0 }))).toBe(true);
    const after = readGearState(defaultGameSession);
    expect(after.inventories.knight).toEqual([{ ...item, affixes: [] }]);
    expect(after.inventories.rogue).toBe(before.inventories.rogue);
    expect(after.loadouts.knight["main-hand"]).toBe(item.instanceId);
    expect(after.craftingCurrencies.voidstone).toBe(1);
    expect(before).toEqual(original);

    const rng = vi.fn(() => 0);
    expect(mutateGearForTest((gear) => gear.applyCurrency("voidstone", item.instanceId, { rng }))).toBe(false);
    expect(readGearState(defaultGameSession)).toEqual(after);
    expect(rng).not.toHaveBeenCalled();
  });

  it.each(["unaffordable", "missing", "ineligible"] as const)(
    "rejects an %s craft without payment or RNG",
    (reason) => {
      initialize(reason === "ineligible" ? { ...item, affixes: [] } : item, reason === "unaffordable" ? 0 : 1);
      const before = structuredClone(readGearState(defaultGameSession));
      const rng = vi.fn(() => 0);
      expect(
        mutateGearForTest((gear) =>
          gear.applyCurrency("voidstone", reason === "missing" ? "absent" : item.instanceId, { rng }),
        ),
      ).toBe(false);
      expect(readGearState(defaultGameSession)).toEqual(before);
      expect(rng).not.toHaveBeenCalled();
    },
  );

  it("salvaging a bow unequips its Quiver without destroying the Quiver", () => {
    const bow: GearInstance = { instanceId: "bow", definitionId: "shortbow-basic", affixes: [] };
    const quiver: GearInstance = { instanceId: "arrows", definitionId: "quiver-basic", affixes: [] };
    resetGearForTest();
    const inventories = createEmptyGearInventories();
    inventories.ranger = [bow, quiver];
    const armed = equipGear(createEmptyGearLoadouts(), "ranger", "main-hand", bow, inventories.ranger);
    const loadouts = equipGear(armed, "ranger", "off-hand", quiver, inventories.ranger);
    mutateGearForTest((gear) => gear.initialize(inventories, loadouts));

    expect(salvageGear(bow.instanceId, defaultGameSession)).toBe(true);
    const after = readGearState(defaultGameSession);
    expect(after.inventories.ranger).toEqual([quiver]);
    expect(after.loadouts.ranger).toEqual(createEmptyGearLoadouts().ranger);
  });
});
