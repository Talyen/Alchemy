import { describe, expect, it } from "vitest";
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  CURRENT_CONTENT_VERSION,
  CURRENT_GAME_BUILD_VERSION,
  SaveDataSchema,
  ActiveRunDataSchema,
  DisplayModeSchema,
  UiScaleSchema,
  MaterialInventorySchema,
} from "@/lib/validation";
import { getRawSaveSchemaVersion, isUnsupportedFutureSaveData, migrateSaveDataToCurrent } from "@/lib/validation";
import { cardLibrary } from "@/lib/game-data";
import { createSeededRng } from "@/lib/utils";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { hydrateCard } from "@/lib/game-data";
import { legacyCampaignRunSave, legacyCorruptedCardRunSave, legacyLabyrinthRunSave } from "../fixtures/legacy-saves";
import type { SaveData } from "@/features/alchemy/shared/storage/types";

function activeRun(overrides: Record<string, unknown> = {}) {
  return {
    characterId: "knight",
    runDeck: [],
    runGold: 0,
    runPlayerHealth: 30,
    runMaxHealth: 30,
    roomsEncountered: 0,
    currentAct: 1,
    destinationIndexInAct: 0,
    completedDestinations: [],
    runTrinkets: [],
    contentSystemType: "campaign",
    ...overrides,
  };
}

const parseActiveRun = (val: unknown) => {
  const result = ActiveRunDataSchema.nullable().catch(null).parse(val);
  if (result) {
    result.runDeck = result.runDeck.map(hydrateCard);
  }
  return result;
};

describe("ActiveRunDataSchema", () => {
  it("returns null for null input", () => {
    expect(parseActiveRun(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseActiveRun(undefined)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(parseActiveRun("string")).toBeNull();
    expect(parseActiveRun(42)).toBeNull();
  });

  it("maps legacy sorcerer to wizard", () => {
    const result = parseActiveRun(activeRun({ characterId: "sorcerer" }));
    expect(result?.characterId).toBe("wizard");
  });

  it("maps legacy warden to ranger", () => {
    const result = parseActiveRun(activeRun({ characterId: "warden" }));
    expect(result?.characterId).toBe("ranger");
  });

  it("passes through valid knight characterId", () => {
    const result = parseActiveRun(activeRun({ characterId: "knight" }));
    expect(result?.characterId).toBe("knight");
  });

  it("preserves corrupted cards in active runs", () => {
    const result = parseActiveRun(activeRun({
      runDeck: [{ id: "slash", title: "Slash", descriptionLines: ["Deal 8 Physical damage"], art: "", cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 8 }], corrupted: true, corruptedValuePositions: [{ lineIndex: 0, matchIndex: 5 }] }],
    }));

    expect(result?.runDeck[0].corrupted).toBe(true);
    expect(result?.runDeck[0].descriptionLines).toEqual(["Deal 8 Physical damage"]);
    expect(result?.runDeck[0].effects[0]).toMatchObject({ amount: 8 });
    expect(result?.runDeck[0].corruptedValuePositions).toEqual([{ lineIndex: 0, matchIndex: 5 }]);
    expect(result?.runDeck[0].art).toBe(cardLibrary.find((card) => card.id === "slash")?.art);
  });

  it("refreshes known saved card art without changing saved gameplay fields", () => {
    const result = parseActiveRun(activeRun({
      runDeck: [{ id: "block", title: "Block", descriptionLines: ["Gain 9 Block"], art: "stale-build-url.webp", cost: 2, effects: [{ kind: "player-status", status: "block", amount: 9 }] }],
    }));

    expect(result?.runDeck[0]).toMatchObject({
      id: "block",
      title: "Block",
      descriptionLines: ["Gain 9 Block"],
      cost: 2,
      effects: [{ kind: "player-status", status: "block", amount: 9 }],
    });
    expect(result?.runDeck[0].art).toBe(cardLibrary.find((card) => card.id === "block")?.art);
  });

  it("does not let saved card data override library-owned fields", () => {
    const result = parseActiveRun(activeRun({
      runDeck: [{
        id: "slash",
        uid: 7,
        title: "Malicious Slash",
        descriptionLines: ["Deal 8 Physical damage"],
        art: "stale-build-url.webp",
        cost: 1,
        effects: [{ kind: "damage", damageType: "physical", amount: 8 }],
        hackedField: true,
      }],
    }));

    const card = result?.runDeck[0];
    expect(card?.title).toBe(cardLibrary.find((c) => c.id === "slash")?.title);
    expect(card?.art).toBe(cardLibrary.find((c) => c.id === "slash")?.art);
    expect(card?.uid).toBe(7);
    expect((card as unknown as { hackedField?: boolean })?.hackedField).toBeUndefined();
  });

  it("drops malformed saved card mutation fields", () => {
    const result = parseActiveRun(activeRun({
      runDeck: [{
        id: "bash",
        title: "Bash",
        descriptionLines: ["bad", 42],
        art: "stale-build-url.webp",
        cost: Number.NaN,
        effects: [null],
        corrupted: true,
        corruptedValuePositions: [{ lineIndex: 0, matchIndex: 3 }, null, { lineIndex: -1, matchIndex: 2 }],
      } as never],
    }));

    const libraryCard = cardLibrary.find((card) => card.id === "bash");
    expect(result?.runDeck[0].descriptionLines).toEqual(libraryCard?.descriptionLines);
    expect(result?.runDeck[0].cost).toBe(libraryCard?.cost);
    expect(result?.runDeck[0].effects).toEqual(libraryCard?.effects);
    // Zod recovers the negative lineIndex to 0 for the second position
    expect(result?.runDeck[0].corruptedValuePositions).toEqual([
      { lineIndex: 0, matchIndex: 3 },
      { lineIndex: 0, matchIndex: 2 },
    ]);
  });

  it("falls back to library effects when a known card has malformed saved effects", () => {
    const result = parseActiveRun(activeRun({
      runDeck: [{
        id: "slash",
        title: "Slash",
        descriptionLines: ["Deal broken damage"],
        art: "stale-build-url.webp",
        cost: 1,
        effects: [
          { kind: "damage", damageType: "physical", amount: "bad" },
          { kind: "summon-companion", companionId: "missing" },
          { kind: "unknown", amount: 99 },
        ],
      }],
    }));

    const libraryCard = cardLibrary.find((card) => card.id === "slash");
    expect(result?.runDeck[0].effects).toEqual(libraryCard?.effects);
  });

  it("falls back to library effects when a known card has mixed valid and invalid saved effects", () => {
    const result = parseActiveRun(activeRun({
      runDeck: [{
        id: "fireball",
        title: "Fireball",
        descriptionLines: ["Deal 10 Burn damage", "Gain 3 Gold"],
        art: "stale-build-url.webp",
        cost: 2,
        effects: [
          { kind: "damage", damageType: "burn", amount: 10 },
          { kind: "gain-gold", amount: "bad" },
        ],
      }],
    }));

    const libraryCard = cardLibrary.find((card) => card.id === "fireball");
    expect(result?.runDeck[0].effects).toEqual(libraryCard?.effects);
  });

  it("keeps only valid saved effects for unknown cards", () => {
    const result = parseActiveRun(activeRun({
      runDeck: [{
        id: "custom-card",
        title: "Custom Card",
        descriptionLines: ["Custom"],
        art: "custom.webp",
        cost: 1,
        effects: [
          { kind: "heal", amount: 4 },
          { kind: "damage", damageType: "physical", amount: "bad" },
        ],
      }],
    }));

    expect(result?.runDeck[0].effects).toEqual([{ kind: "heal", amount: 4 }]);
  });

  it("passes through valid ranger characterId", () => {
    const result = parseActiveRun(activeRun({ characterId: "ranger" }));
    expect(result?.characterId).toBe("ranger");
  });

  it("passes through valid rogue characterId", () => {
    const result = parseActiveRun(activeRun({ characterId: "rogue" }));
    expect(result?.characterId).toBe("rogue");
  });

  it("passes through valid wizard characterId", () => {
    const result = parseActiveRun(activeRun({ characterId: "wizard" }));
    expect(result?.characterId).toBe("wizard");
  });

  it("returns null for unknown characterId", () => {
    const result = parseActiveRun(activeRun({ characterId: "bard" }));
    expect(result).toBeNull();
  });

  it("returns null for character-only fragments", () => {
    const result = parseActiveRun({ characterId: "knight" });
    expect(result).toBeNull();
  });

  it("preserves valid selectedDifficulty", () => {
    const result = parseActiveRun(activeRun({ selectedDifficulty: "difficulty-2" }));
    expect(result?.selectedDifficulty).toBe("difficulty-2");
  });

  it("sets selectedDifficulty to null for invalid value", () => {
    const result = parseActiveRun(activeRun({ selectedDifficulty: "difficulty-999" }));
    expect(result?.selectedDifficulty).toBeNull();
  });

  it("sets selectedDifficulty to null when missing", () => {
    const result = parseActiveRun(activeRun({}));
    expect(result?.selectedDifficulty).toBeNull();
  });

  it("sets selectedDifficulty to null for non-string value", () => {
    const result = parseActiveRun(activeRun({ selectedDifficulty: 42 }));
    expect(result?.selectedDifficulty).toBeNull();
  });

  it("recovers from corrupt numeric run fields with defaults", () => {
    // Zod recovers individual corrupt fields with catch()/defaults instead of discarding the whole run.
    // runPlayerHealth > maxHealth is clamped.
    expect(parseActiveRun(activeRun({ runGold: Number.NaN }))?.runGold).toBe(0);
    expect(parseActiveRun(activeRun({ runPlayerHealth: 31 }))?.runPlayerHealth).toBe(30);
    expect(parseActiveRun(activeRun({ runMaxHealth: 0 }))?.runMaxHealth).toBe(30);
    expect(parseActiveRun(activeRun({ roomsEncountered: -1 }))?.roomsEncountered).toBe(0);
    expect(parseActiveRun(activeRun({ currentAct: 999 }))?.currentAct).toBe(1);
    expect(parseActiveRun(activeRun({ destinationIndexInAct: 1.5 }))?.destinationIndexInAct).toBe(0);
  });

  it("defaults contentSystemType to campaign when missing", () => {
    const result = parseActiveRun(activeRun({ contentSystemType: undefined }));
    expect(result?.contentSystemType).toBe("campaign");
  });

  it("preserves contentSystemType labyrinth when set with a valid map", () => {
    const labyrinthMap = generateLabyrinthMap(createSeededRng(42));
    const result = parseActiveRun(activeRun({ contentSystemType: "labyrinth", labyrinthMap }));
    expect(result?.contentSystemType).toBe("labyrinth");
  });

  it("recovers labyrinth runs without a valid map to campaign", () => {
    const result = parseActiveRun(activeRun({ contentSystemType: "labyrinth" }));
    expect(result).not.toBeNull();
    expect(result?.contentSystemType).toBe("campaign");
  });

  it("preserves valid labyrinth map state", () => {
    const labyrinthMap = generateLabyrinthMap(createSeededRng(42));
    const result = parseActiveRun(activeRun({ contentSystemType: "labyrinth", labyrinthMap }));
    expect(result?.labyrinthMap).toEqual(labyrinthMap);
  });

  it("drops unknown labyrinth modifiers from persisted maps", () => {
    const labyrinthMap = generateLabyrinthMap(createSeededRng(42));
    const firstCombat = labyrinthMap.grid.flat().find((node) => node?.type === "combat");
    expect(firstCombat).toBeDefined();
    firstCombat!.modifiers = ["tempered", "missing-modifier" as never];
    firstCombat!.rewardModifiers = ["generous", "old-reward" as never];

    const result = parseActiveRun(activeRun({ contentSystemType: "labyrinth", labyrinthMap }));

    const normalizedCombat = result?.labyrinthMap?.grid.flat().find((node) => node?.type === "combat");
    expect(normalizedCombat?.modifiers).toEqual(["tempered"]);
    expect(normalizedCombat?.rewardModifiers).toEqual(["generous"]);
  });

  it("recovers from malformed labyrinth maps to campaign", () => {
    const mismatchedRows = generateLabyrinthMap(createSeededRng(42));
    mismatchedRows.rows += 1;

    const invalidConnection = generateLabyrinthMap(createSeededRng(42));
    const firstNode = invalidConnection.grid.flat().find(Boolean);
    firstNode!.connections = [{ row: 999, col: 999 }];

    // Fractional currentNode is recovered by Zod catch() — row 0.5 becomes 0, col 4 stays 4,
    // pointing to a valid entrance node, so the map passes validation.
    expect(parseActiveRun(activeRun({ contentSystemType: "labyrinth", labyrinthMap: mismatchedRows }))?.contentSystemType).toBe("campaign");
    expect(parseActiveRun(activeRun({ contentSystemType: "labyrinth", labyrinthMap: invalidConnection }))?.contentSystemType).toBe("campaign");
  });

  it("recovers from labyrinth maps with impossible current or endpoint state to campaign", () => {
    const multipleCurrent = generateLabyrinthMap(createSeededRng(42));
    const firstVisible = multipleCurrent.grid.flat().find((node) => node?.state === "visible");
    firstVisible!.state = "current";

    const mismatchedCurrent = generateLabyrinthMap(createSeededRng(42));
    mismatchedCurrent.currentNode = { row: 1, col: 4 };

    const missingEntrance = generateLabyrinthMap(createSeededRng(42));
    missingEntrance.grid[0][4]!.type = "combat";

    const missingBoss = generateLabyrinthMap(createSeededRng(42));
    const boss = missingBoss.grid.flat().find((node) => node?.type === "boss");
    boss!.type = "combat";

    expect(parseActiveRun(activeRun({ contentSystemType: "labyrinth", labyrinthMap: multipleCurrent }))?.contentSystemType).toBe("campaign");
    expect(parseActiveRun(activeRun({ contentSystemType: "labyrinth", labyrinthMap: mismatchedCurrent }))?.contentSystemType).toBe("campaign");
    expect(parseActiveRun(activeRun({ contentSystemType: "labyrinth", labyrinthMap: missingEntrance }))?.contentSystemType).toBe("campaign");
    expect(parseActiveRun(activeRun({ contentSystemType: "labyrinth", labyrinthMap: missingBoss }))?.contentSystemType).toBe("campaign");
  });

  it("drops labyrinth map state for campaign runs", () => {
    const labyrinthMap = generateLabyrinthMap(createSeededRng(42));
    const result = parseActiveRun(activeRun({ contentSystemType: "campaign", labyrinthMap }));
    expect(result?.labyrinthMap).toBeNull();
  });

  it("discards legacy wildwood runs without Wildwood Draft state", () => {
    const result = parseActiveRun(activeRun({ contentSystemType: "wildwood" }));
    expect(result).toBeNull();
  });

  it("defaults missing runTalentXP to empty object", () => {
    const result = parseActiveRun(activeRun({}));
    expect(result?.runTalentXP).toEqual({});
  });

  it("preserves runTalentXP when present", () => {
    const result = parseActiveRun(activeRun({ runTalentXP: { burn: 10, poison: 5 } }));
    expect(result?.runTalentXP).toEqual({ burn: 10, poison: 5 });
  });

  it("rejects invalid runTalentXP values and falls back to empty object", () => {
    const result = parseActiveRun(activeRun({ runTalentXP: "invalid" }));
    expect(result?.runTalentXP).toEqual({});
  });
});

describe("DisplayModeSchema", () => {
  const parse = (val: unknown) => DisplayModeSchema.catch("borderless-fullscreen").parse(val);

  it("passes through windowed", () => {
    expect(parse("windowed")).toBe("windowed");
  });

  it("passes through borderless-fullscreen", () => {
    expect(parse("borderless-fullscreen")).toBe("borderless-fullscreen");
  });

  it("passes through fullscreen", () => {
    expect(parse("fullscreen")).toBe("fullscreen");
  });

  it("falls back to default for null", () => {
    expect(parse(null)).toBe("borderless-fullscreen");
  });

  it("falls back to default for undefined", () => {
    expect(parse(undefined)).toBe("borderless-fullscreen");
  });

  it("falls back to default for invalid string", () => {
    expect(parse("fake-mode")).toBe("borderless-fullscreen");
  });

  it("falls back to default for number", () => {
    expect(parse(42)).toBe("borderless-fullscreen");
  });
});

describe("UiScaleSchema", () => {
  const parse = (val: unknown) => UiScaleSchema.catch("100").parse(val);

  it("passes through 90", () => {
    expect(parse("90")).toBe("90");
  });

  it("passes through 100", () => {
    expect(parse("100")).toBe("100");
  });

  it("passes through 110", () => {
    expect(parse("110")).toBe("110");
  });

  it("passes through 120", () => {
    expect(parse("120")).toBe("120");
  });

  it("falls back to default for null", () => {
    expect(parse(null)).toBe("100");
  });

  it("falls back to default for undefined", () => {
    expect(parse(undefined)).toBe("100");
  });

  it("falls back to default for invalid value", () => {
    expect(parse("200")).toBe("100");
  });

  it("falls back to default for number", () => {
    expect(parse(90)).toBe("100");
  });
});

describe("MaterialInventorySchema", () => {
  it("preserves valid inventory", () => {
    const result = MaterialInventorySchema.parse({ wood: 5, iron: 3, herbs: 2, food: 1, crystal: 0 });
    expect(result).toEqual({ wood: 5, iron: 3, herbs: 2, food: 1, crystal: 0 });
  });

  it("fills missing keys with 0", () => {
    const result = MaterialInventorySchema.parse({ wood: 2 });
    expect(result).toEqual({ wood: 2, iron: 0, herbs: 0, food: 0, crystal: 0 });
  });

  it("returns default for null", () => {
    const result = MaterialInventorySchema.parse(null);
    expect(result).toEqual({ wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 });
  });

  it("returns default for undefined", () => {
    const result = MaterialInventorySchema.parse(undefined);
    expect(result).toEqual({ wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 });
  });

  it("returns default for non-object", () => {
    const result = MaterialInventorySchema.parse("string");
    expect(result).toEqual({ wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 });
  });
});

describe("SaveDataSchema", () => {
  const parseSave = (val: unknown) => {
    const result = SaveDataSchema.parse(val) as SaveData;
    if (result.activeRun) {
      result.activeRun.runDeck = result.activeRun.runDeck.map(hydrateCard);
    }
    return result;
  };

  it("treats saves without metadata as legacy v0", () => {
    expect(getRawSaveSchemaVersion({ discoveredCardIds: ["slash"] })).toBe(0);
  });

  it("migrates legacy v0 saves to the current schema", () => {
    const migrated = migrateSaveDataToCurrent({ discoveredCardIds: ["slash"], materialInventory: { wood: 5 } });

    expect(migrated.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(migrated.gameBuildVersion).toBe(CURRENT_GAME_BUILD_VERSION);
    expect(migrated.contentVersion).toBe(CURRENT_CONTENT_VERSION);
    expect(migrated.discoveredCardIds).toEqual(["slash"]);
    expect(migrated.materialInventory).toEqual({ wood: 5 });
  });

  it("migrates legacy v2 saves to the current schema", () => {
    const migrated = migrateSaveDataToCurrent({ saveSchemaVersion: 2, discoveredCardIds: ["slash"] });
    expect(migrated.saveSchemaVersion).toBe(3);
    expect(migrated.finishedRunCharacters).toEqual([]);
  });

  it("fills all defaults for empty input", () => {
    const result = parseSave({});
    expect(result.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(result.gameBuildVersion).toBe(CURRENT_GAME_BUILD_VERSION);
    expect(result.contentVersion).toBe(CURRENT_CONTENT_VERSION);
    expect(result.selectedAspectRatio).toBe("auto");
    expect(result.displayMode).toBe("borderless-fullscreen");
    expect(result.uiScale).toBe("100");
    expect(result.activeRun).toBeNull();
    expect(result.materialInventory).toEqual({ wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 });
    expect(result.constructedBuildings["blacksmiths-forge"]).toBe(0);
    expect(result.completedDifficulties).toEqual({
      knight: [],
      rogue: [],
      wizard: [],
      ranger: [],
      alchemist: [],
      warlock: [],
      druid: [],
      wildcard: [],
    });
    expect(result.finishedRunCharacters).toEqual([]);
  });

  it("preserves current-format homestead tier records", () => {
    const result = parseSave({
      constructedBuildings: { "blacksmiths-forge": 2 },
      plantedFarms: { "herb-garden": 3 },
      completedResearch: { carpentry: 1 },
      bondedCompanions: { wolf: 2 },
    });
    expect(result.constructedBuildings["blacksmiths-forge"]).toBe(2);
    expect(result.plantedFarms["herb-garden"]).toBe(3);
    expect(result.completedResearch.carpentry).toBe(1);
    expect(result.bondedCompanions.wolf).toBe(2);
  });

  it("migrates legacy homestead arrays without dropping progress", () => {
    const result = parseSave({
      constructedBuildings: ["smithy"],
      plantedFarms: ["sheep-pasture"],
    });
    expect(result.constructedBuildings["blacksmiths-forge"]).toBe(1);
    expect(result.plantedFarms.pasture).toBe(1);
  });

  it("ignores character-only active run fragments", () => {
    const result = parseSave({ activeRun: { characterId: "knight" } });
    expect(result.activeRun).toBeNull();
  });

  it("preserves valid partial data", () => {
    const result = parseSave({ displayMode: "fullscreen", uiScale: "120" });
    expect(result.displayMode).toBe("fullscreen");
    expect(result.uiScale).toBe("120");
  });

  it("loads legacy pre-metadata saves without wiping unrelated progress", () => {
    const result = parseSave({
      selectedResolution: "2560x1080",
      discoveredCardIds: ["slash", "future-card"],
      encounteredEnemyIds: ["goblin"],
      discoveredTrinketIds: ["bone-charm"],
      talentXP: { physical: 25 },
      unlockedTalents: { physical: ["physical-dmg-1"] },
      materialInventory: { wood: 7, iron: 3 },
      constructedBuildings: ["smithy"],
      plantedFarms: ["sheep-pasture"],
      completedDifficulties: { knight: ["difficulty-1"] },
    });

    expect(result.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(result.selectedAspectRatio).toBe("21:9");
    expect(result.discoveredCardIds).toEqual(["slash", "future-card"]);
    expect(result.encounteredEnemyIds).toEqual(["goblin"]);
    expect(result.discoveredTrinketIds).toEqual(["bone-charm"]);
    expect(result.talentXP.physical).toBe(25);
    expect(result.unlockedTalents.physical).toEqual(["physical-dmg-1"]);
    expect(result.materialInventory).toEqual({ wood: 7, iron: 3, herbs: 0, food: 0, crystal: 0 });
    expect(result.constructedBuildings["blacksmiths-forge"]).toBe(1);
    expect(result.plantedFarms.pasture).toBe(1);
    expect(result.completedDifficulties.knight).toEqual(["difficulty-1"]);
  });

  it("loads the legacy campaign fixture into current save data", () => {
    const result = parseSave(legacyCampaignRunSave());

    expect(result.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(result.displayMode).toBe("fullscreen");
    expect(result.uiScale).toBe("110");
    expect(result.discoveredCardIds).toEqual(["slash", "block", "future-card"]);
    expect(result.talentXP).toMatchObject({ physical: 18, block: 7 });
    expect(result.activeRun).toMatchObject({ characterId: "knight", runGold: 42, roomsEncountered: 3, contentSystemType: "campaign" });
    expect(result.activeRun?.runDeck[0].art).toBe(cardLibrary.find((card) => card.id === "slash")?.art);
    expect(result.materialInventory).toEqual({ wood: 4, iron: 2, herbs: 0, food: 0, crystal: 0 });
    expect(result.constructedBuildings["blacksmiths-forge"]).toBe(1);
    expect(result.plantedFarms.pasture).toBe(1);
    expect(result.completedResearch.carpentry).toBe(1);
    expect(result.bondedCompanions.wolf).toBe(1);
  });

  it("loads the legacy labyrinth fixture with its map intact", () => {
    const result = parseSave(legacyLabyrinthRunSave());

    expect(result.activeRun?.contentSystemType).toBe("labyrinth");
    expect(result.activeRun?.characterId).toBe("ranger");
    expect(result.activeRun?.labyrinthMap?.currentNode).toEqual({ row: 0, col: 4 });
    expect(result.activeRun?.labyrinthMap?.grid[0]?.[4]?.type).toBe("entrance");
  });

  it("loads the legacy corrupted-card fixture without stale library-owned card fields", () => {
    const result = parseSave(legacyCorruptedCardRunSave());
    const card = result.activeRun?.runDeck[0];

    expect(card?.id).toBe("fireball");
    expect(card?.title).toBe(cardLibrary.find((entry) => entry.id === "fireball")?.title);
    expect(card?.art).toBe(cardLibrary.find((entry) => entry.id === "fireball")?.art);
    expect(card?.descriptionLines).toEqual(["Deal 9 Burn damage"]);
    expect(card?.effects[0]).toMatchObject({ amount: 9 });
    expect(card?.corrupted).toBe(true);
    expect(card?.corruptedValuePositions).toEqual([{ lineIndex: 0, matchIndex: 5 }]);
  });

  it("normalizes corrupt discovery arrays while preserving unknown string ids", () => {
    const result = parseSave({
      discoveredCardIds: ["slash", 123, "future-card", "slash", null] as never,
      encounteredEnemyIds: ["goblin", {}, "future-enemy", "goblin"] as never,
      discoveredTrinketIds: ["bone-charm", false, "future-trinket", "bone-charm"] as never,
    });

    expect(result.discoveredCardIds).toEqual(["slash", "future-card"]);
    expect(result.encounteredEnemyIds).toEqual(["goblin", "future-enemy"]);
    expect(result.discoveredTrinketIds).toEqual(["bone-charm", "future-trinket"]);
  });

  it("normalizes volume and brightness bounds", () => {
    const result = parseSave({ musicVolume: -20, sfxVolume: 200, masterVolume: Number.NaN, brightness: 999 });

    expect(result.musicVolume).toBe(0);
    expect(result.sfxVolume).toBe(100);
    // masterVolume NaN falls back to DEFAULT_MASTER_VOLUME_PCT (50), not the old stale catch(100).
    expect(result.masterVolume).toBe(50);
    expect(result.brightness).toBe(150);
  });

  it("normalizes talent progress without keeping non-finite values", () => {
    const result = parseSave({
      talentXP: { physical: 12.8, burn: Number.NaN, "future-keyword": 4 } as never,
      unlockedTalents: { physical: ["physical-dmg-1", 42, "future-talent", "physical-dmg-1"], burn: "bad" } as never,
    });

    expect(result.talentXP).toEqual({ physical: 12, "future-keyword": 4 });
    expect(result.unlockedTalents).toEqual({ physical: ["physical-dmg-1", "future-talent"] });
  });

  it("normalizes invalid display mode to default", () => {
    const result = parseSave({ displayMode: "fake-mode" as never });
    expect(result.displayMode).toBe("borderless-fullscreen");
  });

  it("preserves completedDifficulties from saved data", () => {
    const result = parseSave({
      completedDifficulties: {
        knight: ["difficulty-1", "difficulty-2"],
        rogue: [],
        wizard: ["difficulty-1"],
        ranger: [],
        alchemist: [],
        warlock: [],
        druid: [],
        wildcard: [],
      },
    });
    expect(result.completedDifficulties).toEqual({
      knight: ["difficulty-1", "difficulty-2"],
      rogue: [],
      wizard: ["difficulty-1"],
      ranger: [],
      alchemist: [],
      warlock: [],
      druid: [],
      wildcard: [],
    });
  });

  it("normalizes completedDifficulties while preserving future string ids", () => {
    const result = parseSave({
      completedDifficulties: {
        knight: ["difficulty-1", 3, "difficulty-future", "difficulty-1"],
        futureHero: ["difficulty-9"],
      } as never,
    });

    expect(result.completedDifficulties).toEqual({
      knight: ["difficulty-1", "difficulty-future"],
      rogue: [],
      wizard: [],
      ranger: [],
      alchemist: [],
      warlock: [],
      druid: [],
      wildcard: [],
      futureHero: ["difficulty-9"],
    });
  });

  it("falls back to default completedDifficulties for non-object", () => {
    const result = parseSave({ completedDifficulties: "invalid" as never });
    expect(result.completedDifficulties).toEqual({
      knight: [],
      rogue: [],
      wizard: [],
      ranger: [],
      alchemist: [],
      warlock: [],
      druid: [],
      wildcard: [],
    });
  });

  it("detects saves from a newer schema", () => {
    expect(isUnsupportedFutureSaveData({ saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1 })).toBe(true);
    expect(isUnsupportedFutureSaveData({ saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION })).toBe(false);
    expect(isUnsupportedFutureSaveData({})).toBe(false);
  });

  it("minimal save round-trips through JSON serialize/deserialize", () => {
    const original = parseSave({ musicVolume: 75, sfxVolume: 25 });
    const serialized = JSON.stringify(original);
    const deserialized = JSON.parse(serialized);
    const reParsed = parseSave(deserialized);
    expect(reParsed).toEqual(original);
  });

  it("active run save round-trips through JSON serialize/deserialize", () => {
    const original = parseSave({
      musicVolume: 60,
      displayMode: "fullscreen",
      activeRun: {
        characterId: "wizard",
        runDeck: [{ id: "fireball", title: "Fireball", descriptionLines: ["Deal 8 Burn damage"], art: "", cost: 2, effects: [{ kind: "damage", damageType: "burn", amount: 8 }] }],
        runGold: 27,
        runPlayerHealth: 18,
        runMaxHealth: 30,
        roomsEncountered: 5,
        currentAct: 2,
        destinationIndexInAct: 1,
        completedDestinations: ["Normal Combat", "Alchemist", "Campfire"],
        runTrinkets: ["bone-charm", "brass-censer"],
        encounteredRunEnemyIds: ["skeleton", "goblin", "imp"],
        selectedDifficulty: null,
        contentSystemType: "campaign",
        labyrinthMap: null,
        labyrinthPendingNode: null,
        activeCombat: null,
        currentScreen: null,
        destinationChoices: [],
        runTalentXP: { burn: 12, poison: 8 },
      } as never,
    });
    const serialized = JSON.stringify(original);
    const deserialized = JSON.parse(serialized);
    const reParsed = parseSave(deserialized);
    expect(reParsed).toEqual(original);
    expect(reParsed.activeRun?.runGold).toBe(27);
    expect(reParsed.activeRun?.runPlayerHealth).toBe(18);
    expect(reParsed.activeRun?.runTalentXP).toEqual({ burn: 12, poison: 8 });
  });

  it("destination resume fields round-trip through JSON serialize/deserialize", () => {
    const original = parseSave({
      activeRun: {
        characterId: "knight",
        runDeck: [],
        runGold: 12,
        runPlayerHealth: 20,
        runMaxHealth: 30,
        roomsEncountered: 2,
        currentAct: 1,
        destinationIndexInAct: 1,
        completedDestinations: ["Normal Combat"],
        runTrinkets: [],
        contentSystemType: "campaign",
        labyrinthMap: null,
        labyrinthPendingNode: null,
        activeCombat: null,
        currentScreen: "destination",
        destinationChoices: ["Campfire", "Mystery", "Merchant's Shop"],
        runTalentXP: {},
      } as never,
    });
    const reParsed = parseSave(JSON.parse(JSON.stringify(original)));
    expect(reParsed.activeRun?.currentScreen).toBe("destination");
    expect(reParsed.activeRun?.destinationChoices).toEqual(["Campfire", "Mystery", "Merchant's Shop"]);
  });

  it("labyrinth map round-trips through JSON serialize/deserialize", () => {
    const labyrinthMap = generateLabyrinthMap(createSeededRng(42));
    const original = parseSave({
      activeRun: {
        characterId: "ranger",
        runDeck: [],
        runGold: 12,
        runPlayerHealth: 24,
        runMaxHealth: 30,
        roomsEncountered: 1,
        currentAct: 1,
        destinationIndexInAct: 0,
        completedDestinations: [],
        runTrinkets: [],
        contentSystemType: "labyrinth",
        labyrinthMap,
        labyrinthPendingNode: null,
        activeCombat: null,
        currentScreen: null,
        destinationChoices: [],
        runTalentXP: {},
      } as never,
    });
    const serialized = JSON.stringify(original);
    const deserialized = JSON.parse(serialized);
    const reParsed = parseSave(deserialized);
    expect(reParsed).toEqual(original);
    expect(reParsed.activeRun?.labyrinthMap?.currentNode).toEqual({ row: 0, col: 4 });
  });

  it("full save with all fields round-trips through JSON serialize/deserialize", () => {
    const original = parseSave({
      selectedAspectRatio: "16:9",
      displayMode: "windowed",
      uiScale: "120",
      brightness: 130,
      musicVolume: 40,
      sfxVolume: 60,
      masterVolume: 80,
      muteInBackground: true,
      autoEndTurn: false,
      discoveredCardIds: ["slash", "block", "bash", "fireball"],
      encounteredEnemyIds: ["skeleton", "goblin"],
      discoveredTrinketIds: ["bone-charm"],
      talentXP: { physical: 25, block: 10 },
      unlockedTalents: { physical: ["physical-dmg-1", "physical-dmg-2"] },
      materialInventory: { wood: 12, iron: 5, herbs: 3, food: 0, crystal: 1 },
      constructedBuildings: { "blacksmiths-forge": 1, "alchemists-laboratory": 1 },
      plantedFarms: { pasture: 1, "herb-garden": 1 },
      completedResearch: { carpentry: 1, masonry: 2 },
      bondedCompanions: { wolf: 3, "lizard-scout": 1 },
      completedDifficulties: { knight: ["difficulty-1"], wizard: ["difficulty-1", "difficulty-2"] },
      activeRun: null,
    });
    const serialized = JSON.stringify(original);
    const deserialized = JSON.parse(serialized);
    const reParsed = parseSave(deserialized);
    expect(reParsed).toEqual(original);
    expect(reParsed.materialInventory).toEqual({ wood: 12, iron: 5, herbs: 3, food: 0, crystal: 1 });
    // bondedCompanions fills defaults for all companion ids, use toMatchObject
    expect(reParsed.bondedCompanions).toMatchObject({ wolf: 3, "lizard-scout": 1 });
  });

  it("round-trip preserves NaN-free serialization", () => {
    const original = parseSave({});
    const serialized = JSON.stringify(original);
    expect(serialized).not.toContain("NaN");
    expect(serialized).not.toContain("undefined");
    const deserialized = JSON.parse(serialized);
    const reParsed = parseSave(deserialized);
    expect(reParsed).toEqual(original);
  });
});
