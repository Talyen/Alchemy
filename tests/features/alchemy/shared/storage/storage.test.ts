import { describe, expect, it } from "vitest";
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  CURRENT_CONTENT_VERSION,
  CURRENT_GAME_BUILD_VERSION,
  SaveDataSchema,
} from "@/lib/validation";
import { getRawSaveSchemaVersion, migrateSaveDataToCurrent } from "@/lib/validation";
import { cardLibrary } from "@/lib/game-data";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import {
  currentSchemaCampaignSave,
  currentSchemaCorruptedCardRunSave,
  currentSchemaLabyrinthRunSave,
} from "../../../../fixtures/legacy-saves";
import type { SaveData } from "@/features/alchemy/shared/storage/types";

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

  it("stamps saveSchemaVersion on v0 input", () => {
    const migrated = migrateSaveDataToCurrent({ discoveredCardIds: ["slash"], materialInventory: { wood: 5 } });

    expect(migrated.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(migrated.discoveredCardIds).toEqual(["slash"]);
    expect(migrated.materialInventory).toEqual({ wood: 5 });
  });

  it("stamps saveSchemaVersion on v2 input", () => {
    const migrated = migrateSaveDataToCurrent({ saveSchemaVersion: 2, discoveredCardIds: ["slash"] });
    expect(migrated.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
  });

  it("fills all defaults for empty input", () => {
    const result = parseSave({});
    expect(result.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(result.gameBuildVersion).toBe(CURRENT_GAME_BUILD_VERSION);
    expect(result.contentVersion).toBe(CURRENT_CONTENT_VERSION);
    expect(result.selectedAspectRatio).toBe("auto");
    expect(result.displayMode).toBe("borderless-fullscreen");
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
      completedResearch: { "leyline-energy": 1 },
      bondedCompanions: { wolf: 2 },
    });
    expect(result.constructedBuildings["blacksmiths-forge"]).toBe(2);
    expect(result.plantedFarms["herb-garden"]).toBe(3);
    expect(result.completedResearch["leyline-energy"]).toBe(1);
    expect(result.bondedCompanions.wolf).toBe(2);
  });

  it("normalizes homestead arrays into tier records", () => {
    const result = parseSave({
      constructedBuildings: ["blacksmiths-forge"],
      plantedFarms: ["pasture"],
    });
    expect(result.constructedBuildings["blacksmiths-forge"]).toBe(1);
    expect(result.plantedFarms.pasture).toBe(1);
  });

  it("ignores character-only active run fragments", () => {
    const result = parseSave({ activeRun: { characterId: "knight" } });
    expect(result.activeRun).toBeNull();
  });

  it("preserves valid partial data", () => {
    const result = parseSave({ displayMode: "fullscreen", brightness: 120 });
    expect(result.displayMode).toBe("fullscreen");
    expect(result.brightness).toBe(120);
  });

  it("strips legacy uiScale from older saves without affecting other fields", () => {
    const result = parseSave({ displayMode: "fullscreen", uiScale: "120" });
    expect(result.displayMode).toBe("fullscreen");
    expect(result).not.toHaveProperty("uiScale");
  });

  it("loads pre-metadata saves without wiping unrelated progress", () => {
    const result = parseSave({
      selectedResolution: "2560x1080",
      discoveredCardIds: ["slash", "bash"],
      encounteredEnemyIds: ["goblin"],
      discoveredTrinketIds: ["bone-charm"],
      talentXP: { burn: 25 },
      unlockedTalents: { burn: ["burn-dmg-1"] },
      materialInventory: { wood: 7, iron: 3 },
      constructedBuildings: ["blacksmiths-forge"],
      plantedFarms: ["pasture"],
      completedDifficulties: { knight: ["difficulty-1"] },
    });

    expect(result.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(result.selectedAspectRatio).toBe("auto");
    expect(result.discoveredCardIds).toEqual(["slash", "bash"]);
    expect(result.encounteredEnemyIds).toEqual(["goblin"]);
    expect(result.discoveredTrinketIds).toEqual(["bone-charm"]);
    expect(result.talentXP.burn).toBe(25);
    expect(result.unlockedTalents.burn).toEqual(["burn-dmg-1"]);
    expect(result.materialInventory).toEqual({ wood: 7, iron: 3, herbs: 0, food: 0, crystal: 0 });
    expect(result.constructedBuildings["blacksmiths-forge"]).toBe(1);
    expect(result.plantedFarms.pasture).toBe(1);
    expect(result.completedDifficulties.knight).toEqual(["difficulty-1"]);
  });

  it("loads the legacy campaign fixture into current save data", () => {
    const result = parseSave(currentSchemaCampaignSave());

    expect(result.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(result.displayMode).toBe("fullscreen");
    expect(result).not.toHaveProperty("uiScale");
    expect(result.discoveredCardIds).toEqual(["slash", "block", "bash"]);
    expect(result.talentXP).toMatchObject({ physical: 18, block: 7 });
    expect(result.activeRun).toMatchObject({
      characterId: "knight",
      runGold: 42,
      roomsEncountered: 3,
      contentSystemType: "campaign",
    });
    expect(result.activeRun?.runDeck[0].art).toBe(cardLibrary.find((card) => card.id === "slash")?.art);
    expect(result.materialInventory).toEqual({ wood: 4, iron: 2, herbs: 0, food: 0, crystal: 0 });
    expect(result.constructedBuildings["blacksmiths-forge"]).toBe(1);
    expect(result.plantedFarms.pasture).toBe(1);
    expect(result.completedResearch["leyline-energy"]).toBe(1);
    expect(result.bondedCompanions.wolf).toBe(1);
  });

  it("loads the legacy labyrinth fixture with its map intact", () => {
    const result = parseSave(currentSchemaLabyrinthRunSave());

    expect(result.activeRun?.contentSystemType).toBe("labyrinth");
    expect(result.activeRun?.characterId).toBe("ranger");
    expect(result.activeRun?.labyrinthMap?.currentNode).toEqual({ row: 0, col: 4 });
    expect(result.activeRun?.labyrinthMap?.grid[0]?.[4]?.type).toBe("entrance");
  });

  it("loads the legacy corrupted-card fixture without stale library-owned card fields", () => {
    const result = parseSave(currentSchemaCorruptedCardRunSave());
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
      discoveredCardIds: ["slash", 123, "not-in-catalog", "slash", null] as never,
      encounteredEnemyIds: ["goblin", {}, "future-enemy", "goblin"] as never,
      discoveredTrinketIds: ["bone-charm", false, "future-boon", "bone-charm"] as never,
    });

    expect(result.discoveredCardIds).toEqual(["slash", "not-in-catalog"]);
    expect(result.encounteredEnemyIds).toEqual(["goblin", "future-enemy"]);
    expect(result.discoveredTrinketIds).toEqual(["bone-charm", "future-boon"]);
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
      unlockedTalents: { burn: ["burn-dmg-1", 42, "burn-dmg-2", "burn-dmg-1"], block: "bad" } as never,
    });

    expect(result.talentXP).toEqual({ physical: 12, "future-keyword": 4 });
    expect(result.unlockedTalents).toEqual({ burn: ["burn-dmg-1", "burn-dmg-2"] });
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

  it("normalizes completedDifficulties to known characters and difficulty ids", () => {
    const result = parseSave({
      completedDifficulties: {
        knight: ["difficulty-1", 3, "difficulty-future", "difficulty-1"],
        futureHero: ["difficulty-9"],
      } as never,
    });

    expect(result.completedDifficulties).toEqual({
      knight: ["difficulty-1"],
      rogue: [],
      wizard: [],
      ranger: [],
      alchemist: [],
      warlock: [],
      druid: [],
      wildcard: [],
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
});
