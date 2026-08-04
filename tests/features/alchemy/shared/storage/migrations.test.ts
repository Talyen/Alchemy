import { describe, expect, it } from "vitest";
import { normalizeSaveData } from "@/features/alchemy/shared/storage/migrations";

describe("normalizeAspectRatio", () => {
  it("passes through valid aspect ratios", () => {
    const result = normalizeSaveData({ selectedAspectRatio: "16:9" });
    expect(result.selectedAspectRatio).toBe("16:9");
  });

  it("falls back for invalid aspect ratio", () => {
    const result = normalizeSaveData({ selectedAspectRatio: "99:99" });
    expect(result.selectedAspectRatio).toBe("auto");
  });

  it("falls back for undefined", () => {
    const result = normalizeSaveData({});
    expect(result.selectedAspectRatio).toBe("auto");
  });
});

describe("normalizeStringList", () => {
  it("passes through string arrays", () => {
    const result = normalizeSaveData({ discoveredCardIds: ["a", "b"] });
    expect(result.discoveredCardIds).toEqual(["a", "b"]);
  });

  it("deduplicates entries", () => {
    const result = normalizeSaveData({ discoveredCardIds: ["a", "b", "a"] });
    expect(result.discoveredCardIds).toEqual(["a", "b"]);
  });

  it("filters non-string entries", () => {
    const result = normalizeSaveData({ discoveredCardIds: ["a", 123 as unknown as string, "b"] });
    expect(result.discoveredCardIds).toEqual(["a", "b"]);
  });

  it("falls back to empty array for non-array input", () => {
    const result = normalizeSaveData({ discoveredCardIds: "bad" as unknown as string[] });
    // Zod uses .catch([]) for invalid arrays — empty array is the safe fallback, not a seeded default.
    expect(Array.isArray(result.discoveredCardIds)).toBe(true);
    expect(result.discoveredCardIds).toEqual([]);
  });

  it("returns empty array when field is missing", () => {
    const result = normalizeSaveData({});
    // discoveredCardIds is optional in raw save; Zod defaults to [] when absent.
    expect(Array.isArray(result.discoveredCardIds)).toBe(true);
    expect(result.discoveredCardIds).toEqual([]);
  });
});

describe("normalizeBoundedNumber", () => {
  it("passes through valid numbers in range", () => {
    const result = normalizeSaveData({ musicVolume: 50 });
    expect(result.musicVolume).toBe(50);
  });

  it("clamps below min", () => {
    const result = normalizeSaveData({ brightness: 10 });
    expect(result.brightness).toBe(50);
  });

  it("clamps above max", () => {
    const result = normalizeSaveData({ brightness: 200 });
    expect(result.brightness).toBe(150);
  });

  it("falls back for NaN", () => {
    const result = normalizeSaveData({ musicVolume: NaN });
    expect(result.musicVolume).toBe(50);
  });

  it("falls back for Infinity", () => {
    const result = normalizeSaveData({ musicVolume: Infinity });
    expect(result.musicVolume).toBe(50);
  });
});

describe("normalizeTalentXP", () => {
  it("passes through valid talent XP", () => {
    const result = normalizeSaveData({ talentXP: { burn: 100, block: 50 } });
    expect(result.talentXP.burn).toBe(100);
    expect(result.talentXP.block).toBe(50);
  });

  it("filters negative XP values", () => {
    const result = normalizeSaveData({ talentXP: { burn: -10, block: 50 } });
    expect(result.talentXP.burn).toBeUndefined();
    expect(result.talentXP.block).toBe(50);
  });

  it("floors non-integer XP", () => {
    const result = normalizeSaveData({ talentXP: { burn: 10.7 } });
    expect(result.talentXP.burn).toBe(10);
  });

  it("falls back for non-object input", () => {
    const result = normalizeSaveData({ talentXP: null });
    expect(result.talentXP).toEqual({});
  });
});

describe("normalizeUnlockedTalents", () => {
  it("passes through valid unlocked talents", () => {
    const result = normalizeSaveData({ unlockedTalents: { burn: ["burn-dmg-1", "burn-dmg-2"], block: [] } });
    expect(result.unlockedTalents.burn).toEqual(["burn-dmg-1", "burn-dmg-2"]);
    expect(result.unlockedTalents.block).toBeUndefined();
  });

  it("filters non-array entries", () => {
    const result = normalizeSaveData({ unlockedTalents: { burn: "bad" as unknown as string[] } });
    expect(result.unlockedTalents.burn).toBeUndefined();
  });

  it("falls back for non-object input", () => {
    const result = normalizeSaveData({ unlockedTalents: null });
    expect(result.unlockedTalents).toEqual({});
  });
});

describe("normalizeCompletedDifficulties", () => {
  it("preserves existing completions", () => {
    const result = normalizeSaveData({
      completedDifficulties: {
        knight: ["difficulty-1"],
        rogue: [],
        wizard: [],
        ranger: [],
        alchemist: [],
        warlock: [],
        druid: [],
        wildcard: [],
      },
    });
    expect(result.completedDifficulties.knight).toEqual(["difficulty-1"]);
  });

  it("fills missing characters with empty arrays", () => {
    const result = normalizeSaveData({ completedDifficulties: { knight: ["difficulty-1"] } });
    expect(result.completedDifficulties.rogue).toEqual([]);
    expect(result.completedDifficulties.wizard).toEqual([]);
    expect(result.completedDifficulties.ranger).toEqual([]);
    expect(result.completedDifficulties.alchemist).toEqual([]);
    expect(result.completedDifficulties.warlock).toEqual([]);
    expect(result.completedDifficulties.druid).toEqual([]);
    expect(result.completedDifficulties.wildcard).toEqual([]);
  });
});

describe("normalizeSaveData", () => {
  it("fills all fields with defaults for empty input", () => {
    const result = normalizeSaveData({});
    expect(result.saveSchemaVersion).toBeGreaterThan(0);
    expect(typeof result.gameBuildVersion).toBe("string");
    expect(typeof result.selectedAspectRatio).toBe("string");
    expect(typeof result.displayMode).toBe("string");
    expect(Array.isArray(result.discoveredCardIds)).toBe(true);
    expect(typeof result.musicVolume).toBe("number");
    expect(typeof result.sfxVolume).toBe("number");
    expect(typeof result.masterVolume).toBe("number");
    expect(typeof result.muteInBackground).toBe("boolean");
    expect(typeof result.autoEndTurn).toBe("boolean");
    expect(Array.isArray(result.encounteredEnemyIds)).toBe(true);
    expect(Array.isArray(result.discoveredTrinketIds)).toBe(true);
    expect(typeof result.talentXP).toBe("object");
    expect(typeof result.unlockedTalents).toBe("object");
    expect(result.activeRun).toBeNull();
    expect(typeof result.materialInventory).toBe("object");
    expect(typeof result.constructedBuildings).toBe("object");
    expect(typeof result.plantedFarms).toBe("object");
    expect(typeof result.completedResearch).toBe("object");
    expect(typeof result.bondedCompanions).toBe("object");
    expect(typeof result.completedDifficulties).toBe("object");
    expect(typeof result.contentVersion).toBe("number");
    expect(typeof result.brightness).toBe("number");
  });

  it("preserves all fields from a valid full save", () => {
    const save = {
      saveSchemaVersion: 1,
      gameBuildVersion: "test-build",
      contentVersion: 3,
      selectedAspectRatio: "16:9" as const,
      displayMode: "windowed" as const,
      uiScale: "120" as const,
      brightness: 120,
      discoveredCardIds: ["card-1", "card-2"],
      encounteredEnemyIds: ["goblin"],
      discoveredTrinketIds: ["boon-a"],
      talentXP: { burn: 50 },
      unlockedTalents: { burn: ["burn-1"] },
      musicVolume: 50,
      sfxVolume: 60,
      masterVolume: 80,
      muteInBackground: false,
      autoEndTurn: false,
      activeRun: null,
      materialInventory: { wood: 10, iron: 5, herbs: 2, food: 0, crystal: 1 },
      constructedBuildings: {} as Record<string, number>,
      plantedFarms: {} as Record<string, number>,
      completedResearch: {} as Record<string, number>,
      bondedCompanions: {} as Record<string, number>,
      completedDifficulties: {
        knight: ["difficulty-1"],
        rogue: [],
        wizard: [],
        ranger: [],
        alchemist: [],
        warlock: [],
        druid: [],
        wildcard: [],
      },
    };
    const result = normalizeSaveData(save);
    expect(result.selectedAspectRatio).toBe("16:9");
    expect(result.musicVolume).toBe(50);
    expect(result.talentXP.burn).toBe(50);
    expect(result.materialInventory.wood).toBe(10);
    expect(result.autoEndTurn).toBe(false);
  });
});

describe("normalizeDisplayMode", () => {
  it("passes through valid display modes", () => {
    const result = normalizeSaveData({ displayMode: "fullscreen" });
    expect(result.displayMode).toBe("fullscreen");
  });

  it("falls back for invalid", () => {
    const result = normalizeSaveData({ displayMode: "fake-mode" as unknown as "windowed" });
    expect(result.displayMode).toBe("borderless-fullscreen");
  });
});

describe("legacy uiScale field", () => {
  it("is stripped from older saves without wiping other settings", () => {
    const result = normalizeSaveData({ uiScale: "110", displayMode: "fullscreen" });
    expect(result.displayMode).toBe("fullscreen");
    expect(result).not.toHaveProperty("uiScale");
  });
});
