import { afterEach, describe, expect, it } from "vitest";
import { buildAlchemySaveDataFromStores } from "@/features/alchemy/shared/storage/build-save-data-from-stores";
import { normalizeSaveData } from "@/features/alchemy/shared/storage/migrations";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";
import {
  createEmptyGearBoardPositionsByCharacter,
  createEmptyGearInventories,
  createEmptyCurrencyBoardPositionsByCharacter,
  createEmptyGearLoadouts,
  equipGear,
  flattenGearInventories,
  type GearInstance,
} from "@/lib/gear";

afterEach(() => {
  useGearStore.getState().reset();
});

function knightInventories(...items: GearInstance[]) {
  const inventories = createEmptyGearInventories();
  inventories.knight = items;
  return inventories;
}

describe("gear save normalization", () => {
  it("defaults old saves to empty per-character inventories and empty class loadouts", () => {
    const save = normalizeSaveData({ saveSchemaVersion: 3 });
    expect(flattenGearInventories(save.gearInventories)).toEqual([]);
    expect(Object.values(save.gearLoadouts).every((loadout) => Object.values(loadout).every((id) => id === null))).toBe(
      true,
    );
  });

  it("discards obsolete Gear trinkets and loadout slots while preserving valid Gear", () => {
    const save = normalizeSaveData({
      saveSchemaVersion: 5,
      gearInventory: [
        { instanceId: "body-1", definitionId: "leather-armor-basic", affixes: [] },
        { instanceId: "old-trinket", definitionId: "placeholder-trinket", affixes: [] },
      ],
      gearLoadouts: {
        knight: { body: "body-1", "trinket-1": "old-trinket" },
      },
    });

    expect(save.gearInventories.knight).toEqual([
      { instanceId: "body-1", definitionId: "leather-armor-basic", affixes: [] },
    ]);
    expect(save.gearLoadouts.knight.body).toBe("body-1");
    expect(save.gearLoadouts.knight).not.toHaveProperty("trinket-1");
  });

  it("keeps only the first loadout reference when legacy saves equip one item multiple times", () => {
    const save = normalizeSaveData({
      saveSchemaVersion: 5,
      gearInventory: [{ instanceId: "ring-1", definitionId: "ruby-ring-basic", affixes: [] }],
      gearLoadouts: {
        knight: { "left-ring": "ring-1" },
        rogue: { "right-ring": "ring-1" },
      },
    });

    expect(save.gearLoadouts.knight["left-ring"]).toBe("ring-1");
    expect(save.gearLoadouts.rogue["right-ring"]).toBeNull();
    expect(save.gearInventories.knight).toEqual([
      { instanceId: "ring-1", definitionId: "ruby-ring-basic", affixes: [] },
    ]);
  });

  it("drops loadout references that are not present in gearInventory", () => {
    const save = normalizeSaveData({
      saveSchemaVersion: 5,
      gearInventory: [{ instanceId: "body-1", definitionId: "leather-armor-basic", affixes: [] }],
      gearLoadouts: {
        knight: { body: "body-1", helm: "missing-helm" },
      },
    });

    expect(save.gearLoadouts.knight.body).toBe("body-1");
    expect(save.gearLoadouts.knight.helm).toBeNull();
  });

  it("normalizes legacy physical modifiers when affix rolls are absent", () => {
    const save = normalizeSaveData({
      saveSchemaVersion: 5,
      gearInventory: [
        {
          instanceId: "body-1",
          definitionId: "leather-armor-basic",
          modifiers: [{ kind: "flatPhysicalDamage", value: 2 }],
        },
      ],
    });

    expect(save.gearInventories.knight[0]?.affixes).toEqual([
      { id: "flat-physical", value: 1 },
      { id: "flat-physical", value: 1 },
    ]);
  });

  it("migrates legacy affix ids and strips invalid entries", () => {
    const save = normalizeSaveData({
      saveSchemaVersion: 5,
      gearInventory: [
        {
          instanceId: "body-1",
          definitionId: "leather-armor-basic",
          affixIds: ["flat-burn-1", "not-an-affix"],
        },
      ],
    });

    expect(save.gearInventories.knight[0]?.affixes).toEqual([{ id: "flat-burn", value: 1 }]);
  });

  it("defaults gear board positions to empty per-character records", () => {
    const save = normalizeSaveData({ saveSchemaVersion: 5 });
    expect(save.gearBoardPositionsByCharacter.knight).toEqual({});
  });

  it("defaults migrated crafting currencies to an empty record", () => {
    const save = normalizeSaveData({ saveSchemaVersion: 6 });
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
    const save = normalizeSaveData({ saveSchemaVersion: 7 });
    expect(save.craftingCurrencyBoardPositionsByCharacter.knight).toEqual({});
  });

  it("preserves valid crafting currency board positions and prunes zero-count currencies", () => {
    const save = normalizeSaveData({
      saveSchemaVersion: 8,
      craftingCurrencies: {
        "discordant-dice": 2,
        "sprig-of-growth": 0,
        voidstone: 1,
        "ascension-seal": 0,
        "severance-maw": 0,
        "smiths-whetstone": 0,
      },
      craftingCurrencyBoardPositions: {
        "discordant-dice": { col: 2, row: 1 },
        "sprig-of-growth": { col: 3, row: 1 },
        voidstone: { col: 0, row: 0 },
      },
    });

    expect(save.craftingCurrencyBoardPositionsByCharacter.knight).toEqual({
      "discordant-dice": { col: 2, row: 1 },
    });
  });

  it("preserves valid crafting currencies while normalizing missing or invalid values", () => {
    const save = normalizeSaveData({
      saveSchemaVersion: 7,
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
    const save = normalizeSaveData({
      saveSchemaVersion: 5,
      gearInventory: [{ instanceId: "body-1", definitionId: "leather-armor-basic", affixes: [] }],
      gearBoardPositions: {
        "body-1": { col: 2, row: 1 },
        "missing-1": { col: 0, row: 0 },
      },
    });

    expect(save.gearBoardPositionsByCharacter.knight).toEqual({ "body-1": { col: 2, row: 1 } });
  });

  it("migrates v8 flat inventory into per-character inventories with equipped ownership", () => {
    const save = normalizeSaveData({
      saveSchemaVersion: 8,
      gearInventory: [
        { instanceId: "body-1", definitionId: "leather-armor-basic", affixes: [] },
        { instanceId: "ring-1", definitionId: "ruby-ring-basic", affixes: [] },
      ],
      gearLoadouts: {
        knight: { body: "body-1" },
        rogue: {},
      },
      gearBoardPositions: {
        "body-1": { col: 2, row: 1 },
        "ring-1": { col: 4, row: 2 },
      },
    });

    expect(save.gearInventories.knight).toEqual([
      { instanceId: "body-1", definitionId: "leather-armor-basic", affixes: [] },
      { instanceId: "ring-1", definitionId: "ruby-ring-basic", affixes: [] },
    ]);
    expect(save.gearInventories.rogue).toEqual([]);
    expect(save.gearBoardPositionsByCharacter.knight).toEqual({ "ring-1": { col: 4, row: 2 } });
    expect(save.gearBoardPositionsByCharacter.rogue).toEqual({});
  });

  it("migrates persisted legacy trinket field names to trinkets", () => {
    const save = normalizeSaveData({
      saveSchemaVersion: 3,
      discoveredTrinketIds: ["bone-charm"],
      activeRun: {
        characterId: "knight",
        runDeck: [],
        runGold: 0,
        runPlayerHealth: 30,
        runMaxHealth: 30,
        roomsEncountered: 0,
        currentAct: 1,
        destinationIndexInAct: 0,
        completedDestinations: [],
        runTrinkets: ["bone-charm"],
        contentSystemType: "campaign",
      },
    });
    expect(save.discoveredTrinketIds).toEqual(["bone-charm"]);
    expect(save.activeRun?.runTrinkets).toEqual(["bone-charm"]);
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
