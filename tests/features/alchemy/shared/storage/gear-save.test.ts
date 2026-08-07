import { afterEach, describe, expect, it } from "vitest";
import { buildAlchemySaveDataFromStores } from "@/features/alchemy/shared/storage/build-save-data-from-stores";
import { normalizeSaveData } from "@/features/alchemy/shared/storage/migrations";
import { useGearStore } from "../../../../helpers/gameplay-store-test";
import {
  createEmptyGearBoardPositionsByCharacter,
  createEmptyGearInventories,
  createEmptyCurrencyBoardPositionsByCharacter,
  createEmptyGearLoadouts,
  equipGear,
  type GearInstance,
  type GearLoadout,
} from "@/lib/gear";
import { CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";

afterEach(() => {
  useGearStore.getState().reset();
});

function knightInventories(...items: GearInstance[]) {
  const inventories = createEmptyGearInventories();
  inventories.knight = items;
  return inventories;
}

describe("gear save normalization", () => {
  it("defaults v10 saves to empty per-character inventories and empty class loadouts", () => {
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
    loadouts.knight["left-ring"] = "ring-1";
    loadouts.rogue["right-ring"] = "ring-1";

    const save = normalizeSaveData({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      gearInventories: inventories,
      gearLoadouts: loadouts,
    });

    expect(save.gearLoadouts.knight["left-ring"]).toBe("ring-1");
    expect(save.gearLoadouts.rogue["right-ring"]).toBeNull();
    expect(save.gearInventories.knight).toEqual([
      { instanceId: "ring-1", definitionId: "ruby-ring-basic", affixes: [] },
    ]);
  });

  it("drops loadout references that are not present in gearInventories", () => {
    const inventories = createEmptyGearInventories();
    inventories.knight = [{ instanceId: "body-1", definitionId: "leather-armor-basic", affixes: [] }];
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight = { ...loadouts.knight, body: "body-1", helm: "missing-helm" };

    const save = normalizeSaveData({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      gearInventories: inventories,
      gearLoadouts: loadouts,
    });

    expect(save.gearLoadouts.knight.body).toBe("body-1");
    expect(save.gearLoadouts.knight.helm).toBeNull();
  });

  it("defaults gear board positions to empty per-character records", () => {
    const save = normalizeSaveData({ saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION });
    expect(save.gearBoardPositionsByCharacter.knight).toEqual({});
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

  it("defaults crafting currency board positions to empty per-character records", () => {
    const save = normalizeSaveData({ saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION });
    expect(save.craftingCurrencyBoardPositionsByCharacter.knight).toEqual({});
  });

  it("preserves valid crafting currency board positions and prunes zero-count currencies", () => {
    const currencyBoardPositions = createEmptyCurrencyBoardPositionsByCharacter();
    currencyBoardPositions.knight = {
      "discordant-dice": { col: 2, row: 1 },
      "sprig-of-growth": { col: 3, row: 1 },
      voidstone: { col: 0, row: 0 },
    };

    const save = normalizeSaveData({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      craftingCurrencies: {
        "discordant-dice": 2,
        "sprig-of-growth": 0,
        voidstone: 1,
        "ascension-seal": 0,
        "severance-maw": 0,
        "smiths-whetstone": 0,
      },
      craftingCurrencyBoardPositionsByCharacter: currencyBoardPositions,
    });

    expect(save.craftingCurrencyBoardPositionsByCharacter.knight).toEqual({
      "discordant-dice": { col: 2, row: 1 },
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

  it("prunes board positions for items no longer in inventory", () => {
    const inventories = createEmptyGearInventories();
    inventories.knight = [{ instanceId: "body-1", definitionId: "leather-armor-basic", affixes: [] }];
    const boardPositions = createEmptyGearBoardPositionsByCharacter();
    boardPositions.knight = {
      "body-1": { col: 2, row: 1 },
      "missing-1": { col: 0, row: 0 },
    };

    const save = normalizeSaveData({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      gearInventories: inventories,
      gearBoardPositionsByCharacter: boardPositions,
    });

    expect(save.gearBoardPositionsByCharacter.knight).toEqual({ "body-1": { col: 2, row: 1 } });
  });

  it("preserves per-character inventories with equipped ownership", () => {
    const inventories = createEmptyGearInventories();
    inventories.knight = [
      { instanceId: "body-1", definitionId: "leather-armor-basic", affixes: [] },
      { instanceId: "ring-1", definitionId: "ruby-ring-basic", affixes: [] },
    ];
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight.body = "body-1";
    const boardPositions = createEmptyGearBoardPositionsByCharacter();
    boardPositions.knight = {
      "body-1": { col: 2, row: 1 },
      "ring-1": { col: 4, row: 2 },
    };

    const save = normalizeSaveData({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      gearInventories: inventories,
      gearLoadouts: loadouts,
      gearBoardPositionsByCharacter: boardPositions,
    });

    expect(save.gearInventories.knight).toEqual([
      { instanceId: "body-1", definitionId: "leather-armor-basic", affixes: [] },
      { instanceId: "ring-1", definitionId: "ruby-ring-basic", affixes: [] },
    ]);
    expect(save.gearInventories.rogue).toEqual([]);
    expect(save.gearBoardPositionsByCharacter.knight).toEqual({ "ring-1": { col: 4, row: 2 } });
    expect(save.gearBoardPositionsByCharacter.rogue).toEqual({});
  });

  it("round-trips gear store state through buildAlchemySaveDataFromStores and normalizeSaveData", () => {
    const body: GearInstance = {
      instanceId: "body-1",
      definitionId: "leather-armor-basic",
      affixes: [{ id: "flat-physical", value: 2 }],
    };
    const ring: GearInstance = { instanceId: "ring-1", definitionId: "ruby-ring-basic", affixes: [] };
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "body", body, [body, ring]);
    const boardPositions = {
      [ring.instanceId]: { col: 2, row: 1 },
    };
    const craftingCurrencies = {
      "discordant-dice": 2,
      "sprig-of-growth": 0,
      voidstone: 1,
      "ascension-seal": 0,
      "severance-maw": 0,
      "smiths-whetstone": 0,
    };
    const currencyBoardPositions = {
      "discordant-dice": { col: 1, row: 1 },
      voidstone: { col: 3, row: 1 },
    };

    const gearBoardPositionsByCharacter = createEmptyGearBoardPositionsByCharacter();
    gearBoardPositionsByCharacter.knight = boardPositions;
    const currencyBoardPositionsByCharacter = createEmptyCurrencyBoardPositionsByCharacter();
    currencyBoardPositionsByCharacter.knight = currencyBoardPositions;

    useGearStore
      .getState()
      .initialize(
        knightInventories(body, ring),
        loadouts,
        gearBoardPositionsByCharacter,
        craftingCurrencies,
        currencyBoardPositionsByCharacter,
      );

    const save = buildAlchemySaveDataFromStores(null);
    const normalized = normalizeSaveData(save);

    expect(normalized.gearInventories.knight).toEqual([body, ring]);
    expect(normalized.gearLoadouts.knight.body).toBe("body-1");
    expect(normalized.gearLoadouts.knight["left-ring"]).toBeNull();
    expect(normalized.gearBoardPositionsByCharacter.knight).toEqual(boardPositions);
    expect(normalized.craftingCurrencies).toEqual(craftingCurrencies);
    expect(normalized.craftingCurrencyBoardPositionsByCharacter.knight).toEqual({
      "discordant-dice": { col: 1, row: 1 },
      voidstone: { col: 3, row: 1 },
    });
  });
});
