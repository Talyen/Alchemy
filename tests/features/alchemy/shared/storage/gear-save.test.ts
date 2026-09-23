import { afterEach, describe, expect, it } from "vitest";
import { buildAlchemySaveDataFromStores } from "@/features/alchemy/shared/storage/persistence";
import { normalizeSaveData } from "../../../../helpers/parse-save-for-tests";
import { mutateGearForTest, resetGearForTest } from "../../../../helpers/run-domain-store-test";

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
  resetGearForTest();
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

  it("keeps a saved Gear instance only once even when multiple inventories claim its ID", () => {
    const inventories = createEmptyGearInventories();
    const ring = { instanceId: "ring-1", definitionId: "ruby-ring-basic", affixes: [] };
    inventories.knight = [ring, { ...ring }];
    inventories.rogue = [{ ...ring }];

    const save = normalizeSaveData({ saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION, gearInventories: inventories });

    expect(save.gearInventories.knight).toEqual([ring]);
    expect(save.gearInventories.rogue).toEqual([]);
  });

  it("removes a saved loadout reference when the item cannot occupy that slot", () => {
    const inventories = knightInventories({ instanceId: "ring-1", definitionId: "ruby-ring-basic", affixes: [] });
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight.body = "ring-1";

    const save = normalizeSaveData({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      gearInventories: inventories,
      gearLoadouts: loadouts,
    });

    expect(save.gearLoadouts.knight.body).toBeNull();
  });

  it("keeps a valid equipment owner when a conflicting earlier loadout is repaired", () => {
    const staff = { instanceId: "staff-1", definitionId: "staff-basic", affixes: [] };
    const shield = { instanceId: "shield-1", definitionId: "leather-buckler-basic", affixes: [] };
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight["main-hand"] = staff.instanceId;
    loadouts.knight["off-hand"] = shield.instanceId;
    loadouts.rogue["off-hand"] = shield.instanceId;

    const save = normalizeSaveData({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      gearInventories: knightInventories(staff, shield),
      gearLoadouts: loadouts,
    });

    expect(save.gearLoadouts.knight["off-hand"]).toBeNull();
    expect(save.gearLoadouts.rogue["off-hand"]).toBe(shield.instanceId);
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

    mutateGearForTest((gear) => gear.initialize(knightInventories(body, ring), loadouts, craftingCurrencies));

    const save = buildAlchemySaveDataFromStores(null);
    const normalized = normalizeSaveData(save);

    expect(normalized.gearInventories.knight).toEqual([body, ring]);
    expect(normalized.gearLoadouts.knight.body).toBe("body-1");
    expect(normalized.gearLoadouts.knight["left-accessory"]).toBeNull();
    expect(normalized.craftingCurrencies).toEqual(craftingCurrencies);
  });

  it("round-trips trinket exclusivity and clones snapshots", () => {
    const sword: GearInstance = {
      instanceId: "sword-1",
      definitionId: "shortsword-basic",
      affixes: [{ id: "flat-physical", value: 1 }],
    };
    mutateGearForTest((gear) => {
      gear.initialize(knightInventories(sword), createEmptyGearLoadouts());
      gear.addTrinket("bone-charm");
      gear.equipTrinket("knight", "bone-charm");
    });

    const save = buildAlchemySaveDataFromStores(null);
    expect(save.gearInventories.knight[0]?.instanceId).toBe("sword-1");
    expect(save.equippedTrinkets.knight).toBe("bone-charm");

    save.gearInventories.knight[0]!.affixes[0]!.value = 999;
    save.gearInventories.knight.push({ instanceId: "injected", definitionId: "shortsword-basic", affixes: [] });
    const fresh = buildAlchemySaveDataFromStores(null);
    expect(fresh.gearInventories.knight).toHaveLength(1);
    expect(fresh.gearInventories.knight[0]?.affixes[0]?.value).toBe(1);

    const normalized = normalizeSaveData(save);
    expect(normalized.gearInventories.knight.some((item) => item.instanceId === "sword-1")).toBe(true);
  });
});
