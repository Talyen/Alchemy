import { describe, expect, it } from "vitest";
import { normalizeActiveRun, normalizeSaveData, normalizeDisplayMode, normalizeUiScale, migrateMaterialInventory, migrateBuildingIds, migrateFarmIds, migrateToTierLevels } from "@/features/alchemy/storage";
import { cardLibrary } from "@/lib/game-data";
import { buildings, farmPlots } from "@/lib/homestead/data";
import { createSeededRng, generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";

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
    ...overrides,
  };
}

describe("normalizeActiveRun", () => {
  it("returns null for null input", () => {
    expect(normalizeActiveRun(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(normalizeActiveRun(undefined)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(normalizeActiveRun("string")).toBeNull();
    expect(normalizeActiveRun(42)).toBeNull();
  });

  it("maps legacy sorcerer to wizard", () => {
    const result = normalizeActiveRun(activeRun({ characterId: "sorcerer" }));
    expect(result?.characterId).toBe("wizard");
  });

  it("maps legacy warden to ranger", () => {
    const result = normalizeActiveRun(activeRun({ characterId: "warden" }));
    expect(result?.characterId).toBe("ranger");
  });

  it("passes through valid knight characterId", () => {
    const result = normalizeActiveRun(activeRun({ characterId: "knight" }));
    expect(result?.characterId).toBe("knight");
  });

  it("preserves corrupted cards in active runs", () => {
    const result = normalizeActiveRun(activeRun({
      runDeck: [{ id: "slash", title: "Slash", descriptionLines: ["Deal 8 Physical damage"], art: "", cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 8 }], corrupted: true, corruptedValuePositions: [{ lineIndex: 0, matchIndex: 5 }] }],
    }));

    expect(result?.runDeck[0].corrupted).toBe(true);
    expect(result?.runDeck[0].descriptionLines).toEqual(["Deal 8 Physical damage"]);
    expect(result?.runDeck[0].effects[0]).toMatchObject({ amount: 8 });
    expect(result?.runDeck[0].corruptedValuePositions).toEqual([{ lineIndex: 0, matchIndex: 5 }]);
    expect(result?.runDeck[0].art).toBe(cardLibrary.find((card) => card.id === "slash")?.art);
  });

  it("refreshes known saved card art without changing saved gameplay fields", () => {
    const result = normalizeActiveRun(activeRun({
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

  it("passes through valid ranger characterId", () => {
    const result = normalizeActiveRun(activeRun({ characterId: "ranger" }));
    expect(result?.characterId).toBe("ranger");
  });

  it("passes through valid rogue characterId", () => {
    const result = normalizeActiveRun(activeRun({ characterId: "rogue" }));
    expect(result?.characterId).toBe("rogue");
  });

  it("passes through valid wizard characterId", () => {
    const result = normalizeActiveRun(activeRun({ characterId: "wizard" }));
    expect(result?.characterId).toBe("wizard");
  });

  it("returns null for unknown characterId", () => {
    const result = normalizeActiveRun(activeRun({ characterId: "bard" }));
    expect(result).toBeNull();
  });

  it("returns null for character-only fragments", () => {
    const result = normalizeActiveRun({ characterId: "knight" });
    expect(result).toBeNull();
  });

  it("preserves valid selectedDifficulty", () => {
    const result = normalizeActiveRun(activeRun({ selectedDifficulty: "difficulty-2" }));
    expect(result?.selectedDifficulty).toBe("difficulty-2");
  });

  it("sets selectedDifficulty to null for invalid value", () => {
    const result = normalizeActiveRun(activeRun({ selectedDifficulty: "difficulty-999" }));
    expect(result?.selectedDifficulty).toBeNull();
  });

  it("sets selectedDifficulty to null when missing", () => {
    const result = normalizeActiveRun(activeRun({}));
    expect(result?.selectedDifficulty).toBeNull();
  });

  it("sets selectedDifficulty to null for non-string value", () => {
    const result = normalizeActiveRun(activeRun({ selectedDifficulty: 42 }));
    expect(result?.selectedDifficulty).toBeNull();
  });

  it("defaults contentSystemType to campaign when missing", () => {
    const result = normalizeActiveRun(activeRun({}));
    expect(result?.contentSystemType).toBe("campaign");
  });

  it("preserves contentSystemType labyrinth when set", () => {
    const result = normalizeActiveRun(activeRun({ contentSystemType: "labyrinth" }));
    expect(result?.contentSystemType).toBe("labyrinth");
  });

  it("preserves valid labyrinth map state", () => {
    const labyrinthMap = generateLabyrinthMap(createSeededRng(42));
    const result = normalizeActiveRun(activeRun({ contentSystemType: "labyrinth", labyrinthMap }));
    expect(result?.labyrinthMap).toEqual(labyrinthMap);
  });

  it("drops unknown labyrinth modifiers from persisted maps", () => {
    const labyrinthMap = generateLabyrinthMap(createSeededRng(42));
    const firstCombat = labyrinthMap.grid.flat().find((node) => node?.type === "combat");
    expect(firstCombat).toBeDefined();
    firstCombat!.modifiers = ["armored", "missing-modifier" as never];
    firstCombat!.rewardModifiers = ["generous", "old-reward" as never];

    const result = normalizeActiveRun(activeRun({ contentSystemType: "labyrinth", labyrinthMap }));

    const normalizedCombat = result?.labyrinthMap?.grid.flat().find((node) => node?.type === "combat");
    expect(normalizedCombat?.modifiers).toEqual(["armored"]);
    expect(normalizedCombat?.rewardModifiers).toEqual(["generous"]);
  });

  it("drops labyrinth map state for campaign runs", () => {
    const labyrinthMap = generateLabyrinthMap(createSeededRng(42));
    const result = normalizeActiveRun(activeRun({ contentSystemType: "campaign", labyrinthMap }));
    expect(result?.labyrinthMap).toBeNull();
  });

  it("coerces unknown contentSystemType to campaign", () => {
    const result = normalizeActiveRun(activeRun({ contentSystemType: "wildwood" }));
    expect(result?.contentSystemType).toBe("campaign");
  });
});

describe("normalizeDisplayMode", () => {
  it("passes through windowed", () => {
    expect(normalizeDisplayMode("windowed")).toBe("windowed");
  });

  it("passes through borderless-fullscreen", () => {
    expect(normalizeDisplayMode("borderless-fullscreen")).toBe("borderless-fullscreen");
  });

  it("passes through fullscreen", () => {
    expect(normalizeDisplayMode("fullscreen")).toBe("fullscreen");
  });

  it("falls back to default for null", () => {
    expect(normalizeDisplayMode(null)).toBe("borderless-fullscreen");
  });

  it("falls back to default for undefined", () => {
    expect(normalizeDisplayMode(undefined)).toBe("borderless-fullscreen");
  });

  it("falls back to default for invalid string", () => {
    expect(normalizeDisplayMode("fake-mode")).toBe("borderless-fullscreen");
  });

  it("falls back to default for number", () => {
    expect(normalizeDisplayMode(42)).toBe("borderless-fullscreen");
  });
});

describe("normalizeUiScale", () => {
  it("passes through 90", () => {
    expect(normalizeUiScale("90")).toBe("90");
  });

  it("passes through 100", () => {
    expect(normalizeUiScale("100")).toBe("100");
  });

  it("passes through 110", () => {
    expect(normalizeUiScale("110")).toBe("110");
  });

  it("passes through 120", () => {
    expect(normalizeUiScale("120")).toBe("120");
  });

  it("falls back to default for null", () => {
    expect(normalizeUiScale(null)).toBe("100");
  });

  it("falls back to default for undefined", () => {
    expect(normalizeUiScale(undefined)).toBe("100");
  });

  it("falls back to default for invalid value", () => {
    expect(normalizeUiScale("200")).toBe("100");
  });

  it("falls back to default for number", () => {
    expect(normalizeUiScale(90)).toBe("100");
  });
});

describe("migrateMaterialInventory", () => {
  it("preserves valid inventory", () => {
    const result = migrateMaterialInventory({ wood: 5, iron: 3, herbs: 2, food: 1, crystal: 0 });
    expect(result).toEqual({ wood: 5, iron: 3, herbs: 2, food: 1, crystal: 0 });
  });

  it("fills missing keys with 0", () => {
    const result = migrateMaterialInventory({ wood: 2 });
    expect(result).toEqual({ wood: 2, iron: 0, herbs: 0, food: 0, crystal: 0 });
  });

  it("returns default for null", () => {
    const result = migrateMaterialInventory(null);
    expect(result).toEqual({ wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 });
  });

  it("returns default for undefined", () => {
    const result = migrateMaterialInventory(undefined);
    expect(result).toEqual({ wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 });
  });

  it("returns default for non-object", () => {
    const result = migrateMaterialInventory("string");
    expect(result).toEqual({ wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 });
  });
});

describe("migrateBuildingIds", () => {
  it("passes through known building IDs", () => {
    const result = migrateBuildingIds(["blacksmiths-forge", "hunters-lodge"]);
    expect(result).toEqual(["blacksmiths-forge", "hunters-lodge"]);
  });

  it("maps smithy to blacksmiths-forge", () => {
    const result = migrateBuildingIds(["smithy"]);
    expect(result).toEqual(["blacksmiths-forge"]);
  });

  it("passes through unknown IDs", () => {
    const result = migrateBuildingIds(["future-building"]);
    expect(result).toEqual(["future-building"]);
  });

  it("returns default for null", () => {
    const result = migrateBuildingIds(null);
    expect(result).toEqual([]);
  });

  it("returns default for non-array", () => {
    const result = migrateBuildingIds({});
    expect(result).toEqual([]);
  });
});

describe("migrateFarmIds", () => {
  it("passes through known farm IDs", () => {
    const result = migrateFarmIds(["wheat-field", "herb-garden"]);
    expect(result).toEqual(["wheat-field", "herb-garden"]);
  });

  it("maps sheep-pasture to pasture", () => {
    const result = migrateFarmIds(["sheep-pasture"]);
    expect(result).toEqual(["pasture"]);
  });

  it("passes through unknown IDs", () => {
    const result = migrateFarmIds(["future-farm"]);
    expect(result).toEqual(["future-farm"]);
  });

  it("returns default for null", () => {
    const result = migrateFarmIds(null);
    expect(result).toEqual([]);
  });

  it("returns default for non-array", () => {
    const result = migrateFarmIds("string");
    expect(result).toEqual([]);
  });
});

describe("migrateToTierLevels", () => {
  it("converts legacy arrays to level 1 records", () => {
    const result = migrateToTierLevels(["blacksmiths-forge"], buildings);
    expect(result["blacksmiths-forge"]).toBe(1);
    expect(result["hunters-lodge"]).toBe(0);
  });

  it("preserves current record-shaped saves", () => {
    const result = migrateToTierLevels({ "blacksmiths-forge": 2, "hunters-lodge": 1 }, buildings);
    expect(result["blacksmiths-forge"]).toBe(2);
    expect(result["hunters-lodge"]).toBe(1);
  });

  it("maps renamed IDs in arrays and records", () => {
    const fromArray = migrateToTierLevels(["smithy"], buildings, { smithy: "blacksmiths-forge" });
    const fromRecord = migrateToTierLevels({ smithy: 2 }, buildings, { smithy: "blacksmiths-forge" });
    expect(fromArray["blacksmiths-forge"]).toBe(1);
    expect(fromRecord["blacksmiths-forge"]).toBe(2);
  });

  it("ignores unknown IDs", () => {
    const result = migrateToTierLevels({ "future-building": 3 }, buildings);
    expect(Object.keys(result)).not.toContain("future-building");
  });

  it("clamps invalid record levels", () => {
    const result = migrateToTierLevels({
      "blacksmiths-forge": 99,
      "hunters-lodge": -1,
      "alchemy-lab": 1.8,
      "placeholder-1": Number.NaN,
      "placeholder-2": "2",
    }, buildings);
    expect(result["blacksmiths-forge"]).toBe(3);
    expect(result["hunters-lodge"]).toBe(0);
    expect(result["alchemy-lab"]).toBe(1);
    expect(result["placeholder-1"]).toBe(0);
    expect(result["placeholder-2"]).toBe(0);
  });
});

describe("normalizeSaveData", () => {
  it("fills all defaults for empty input", () => {
    const result = normalizeSaveData({});
    expect(result.selectedResolution).toBe("1920x1080");
    expect(result.displayMode).toBe("borderless-fullscreen");
    expect(result.uiScale).toBe("100");
    expect(result.activeRun).toBeNull();
    expect(result.materialInventory).toEqual({ wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 });
    expect(result.constructedBuildings["blacksmiths-forge"]).toBe(0);
    expect(result.completedDifficulties).toEqual({ knight: [], rogue: [], wizard: [], ranger: [] });
  });

  it("preserves current-format homestead tier records", () => {
    const result = normalizeSaveData({
      constructedBuildings: { "blacksmiths-forge": 2 } as never,
      plantedFarms: { "herb-garden": 3 } as never,
      completedResearch: { carpentry: 1 } as never,
      bondedCompanions: { wolf: 2 } as never,
    });
    expect(result.constructedBuildings["blacksmiths-forge"]).toBe(2);
    expect(result.plantedFarms["herb-garden"]).toBe(3);
    expect(result.completedResearch.carpentry).toBe(1);
    expect(result.bondedCompanions.wolf).toBe(2);
  });

  it("migrates legacy homestead arrays without dropping progress", () => {
    const result = normalizeSaveData({
      constructedBuildings: ["smithy"] as never,
      plantedFarms: ["sheep-pasture"] as never,
    });
    expect(result.constructedBuildings["blacksmiths-forge"]).toBe(1);
    expect(result.plantedFarms.pasture).toBe(1);
  });

  it("ignores character-only active run fragments", () => {
    const result = normalizeSaveData({ activeRun: { characterId: "knight" } as never });
    expect(result.activeRun).toBeNull();
  });

  it("preserves valid partial data", () => {
    const result = normalizeSaveData({ displayMode: "fullscreen", uiScale: "120" });
    expect(result.displayMode).toBe("fullscreen");
    expect(result.uiScale).toBe("120");
  });

  it("normalizes invalid display mode to default", () => {
    const result = normalizeSaveData({ displayMode: "fake-mode" as never });
    expect(result.displayMode).toBe("borderless-fullscreen");
  });

  it("preserves completedDifficulties from saved data", () => {
    const result = normalizeSaveData({ completedDifficulties: { knight: ["difficulty-1", "difficulty-2"], rogue: [], wizard: ["difficulty-1"], ranger: [] } });
    expect(result.completedDifficulties).toEqual({ knight: ["difficulty-1", "difficulty-2"], rogue: [], wizard: ["difficulty-1"], ranger: [] });
  });

  it("falls back to default completedDifficulties for non-object", () => {
    const result = normalizeSaveData({ completedDifficulties: "invalid" as never });
    expect(result.completedDifficulties).toEqual({ knight: [], rogue: [], wizard: [], ranger: [] });
  });
});
