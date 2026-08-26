import { afterEach, describe, expect, it } from "vitest";
import { buildAlchemySaveDataFromStores } from "@/features/alchemy/shared/storage/build-save-data-from-stores";
import { normalizeSaveData } from "../../../../helpers/parse-save-for-tests";
import { useGearStore } from "../../../../helpers/gameplay-store-test";

function knightInventories(...items: GearInstance[]) {
  const inventories = createEmptyGearInventories();
  inventories.knight = items;
  return inventories;
}
import {
  createEmptyGearInventories,
  createEmptyGearLoadouts,
  equipGear,
  type GearInstance,
  type GearLoadout,
} from "@/lib/gear";
import { CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";

afterEach(() => {
  useGearStore.getState().reset();
});

describe("gear save normalization", () => {
  it("defaults saves to empty per-character inventories and empty class loadouts", () => {
    const save = normalizeSaveData({ saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION });
    expect(save.gearInventories.knight).toEqual([]);
    expect(Object.values(save.gearLoadouts).every((loadout) => Object.values(loadout).every((id) => id === null))).toBe(
      true,
    );
  });

  it("discards obsolete Gear trinkets and loadout slots while preserving valid Gear", () => {
    const inventories = createEmptyGearInventories();
    inventories.knight = [
      { instanceId: "body-1", definitionId: "leather-armor-basic", affixes: [] },
      { instanceId: "old-trinket", definitionId: "placeholder-trinket", affixes: [] },
    ];
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight = { ...loadouts.knight, body: "body-1", "trinket-1": "old-trinket" } as GearLoadout;

    const save = normalizeSaveData({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      gearInventories: inventories,
      gearLoadouts: loadouts,
    });

    expect(save.gearInventories.knight).toEqual([
      { instanceId: "body-1", definitionId: "leather-armor-basic", affixes: [] },
    ]);
    expect(save.gearLoadouts.knight.body).toBe("body-1");
    expect(save.gearLoadouts.knight).not.toHaveProperty("trinket-1");
  });

  it("keeps only the first loadout reference when one item is equipped on multiple classes", () => {
    const inventories = createEmptyGearInventories();
    inventories.knight = [{ instanceId: "ring-1", definitionId: "ruby-ring-basic", affixes: [] }];
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight["left-accessory"] = "ring-1";
    loadouts.rogue["right-accessory"] = "ring-1";

    const save = normalizeSaveData({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      gearInventories: inventories,
      gearLoadouts: loadouts,
    });

    expect(save.gearLoadouts.knight["left-accessory"]).toBe("ring-1");
    expect(save.gearLoadouts.rogue["right-accessory"]).toBeNull();
  });

  it("drops loadout references that are not present in gearInventories", () => {
    const inventories = createEmptyGearInventories();
    inventories.knight = [{ instanceId: "body-1", definitionId: "leather-armor-basic", affixes: [] }];
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight = { ...loadouts.knight, body: "body-1", "main-hand": "missing-sword" };

    const save = normalizeSaveData({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      gearInventories: inventories,
      gearLoadouts: loadouts,
    });

    expect(save.gearLoadouts.knight.body).toBe("body-1");
    expect(save.gearLoadouts.knight["main-hand"]).toBeNull();
  });

  it("defaults crafting currencies to an empty record", () => {
    const save = normalizeSaveData({ saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION });
    expect(save.craftingCurrencies).toEqual({
      "discordant-dice": 0,
      "sprig-of-growth": 0,
      voidstone: 0,
      "ascension-seal": 0,
      "severance-maw": 0,
      "smiths-whetstone": 0,
    });
  });

  it("preserves valid crafting currencies while normalizing missing or invalid values", () => {
    const save = normalizeSaveData({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      craftingCurrencies: {
        "discordant-dice": 3,
        "sprig-of-growth": -1,
        voidstone: 2.5,
      },
    });

    expect(save.craftingCurrencies).toEqual({
      "discordant-dice": 3,
      "sprig-of-growth": 0,
      voidstone: 2,
      "ascension-seal": 0,
      "severance-maw": 0,
      "smiths-whetstone": 0,
    });
  });

  it("round-trips gear store state through buildAlchemySaveDataFromStores and normalizeSaveData", () => {
    const body: GearInstance = {
      instanceId: "body-1",
      definitionId: "leather-armor-basic",
      affixes: [{ id: "flat-physical", value: 2 }],
    };
    const ring: GearInstance = { instanceId: "ring-1", definitionId: "ruby-ring-basic", affixes: [] };
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "body", body, [body, ring]);
    const craftingCurrencies = {
      "discordant-dice": 2,
      "sprig-of-growth": 0,
      voidstone: 1,
      "ascension-seal": 0,
      "severance-maw": 0,
      "smiths-whetstone": 0,
    };

    useGearStore.getState().initialize(knightInventories(body, ring), loadouts, craftingCurrencies);

    const save = buildAlchemySaveDataFromStores(null);
    const normalized = normalizeSaveData(save);

    expect(normalized.gearInventories.knight).toEqual([body, ring]);
    expect(normalized.gearLoadouts.knight.body).toBe("body-1");
    expect(normalized.gearLoadouts.knight["left-accessory"]).toBeNull();
    expect(normalized.craftingCurrencies).toEqual(craftingCurrencies);
  });
});
