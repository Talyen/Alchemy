import { describe, expect, it } from "vitest";
import {
  difficultyConfigs,
  DIFFICULTY_ORDER,
  isDifficultyUnlocked,
  getDifficultyModifiers,
  getGoldMultiplier,
  getDifficultyXPMultiplier,
  type CharacterId,
} from "@/lib/game-data/difficulties";

const ALL_CHARACTERS: CharacterId[] = [
  "knight",
  "rogue",
  "wizard",
  "ranger",
  "alchemist",
  "warlock",
  "druid",
  "wildcard",
];

describe("difficultyConfigs data integrity", () => {
  it("has configs for all 8 characters", () => {
    for (const char of ALL_CHARACTERS) {
      expect(difficultyConfigs[char]).toBeDefined();
      expect(difficultyConfigs[char].headerTitle).toBeTruthy();
    }
  });

  it("each character has exactly 3 difficulties in order 1/2/3", () => {
    for (const char of ALL_CHARACTERS) {
      const diffs = difficultyConfigs[char].difficulties;
      expect(diffs).toHaveLength(3);
      expect(diffs[0].id).toBe("difficulty-1");
      expect(diffs[1].id).toBe("difficulty-2");
      expect(diffs[2].id).toBe("difficulty-3");
      expect(diffs[0].order).toBe(1);
      expect(diffs[1].order).toBe(2);
      expect(diffs[2].order).toBe(3);
    }
  });

  it("each difficulty has a non-empty name and description", () => {
    for (const char of ALL_CHARACTERS) {
      for (const diff of difficultyConfigs[char].difficulties) {
        expect(diff.name).toBeTruthy();
        expect(diff.description).toBeTruthy();
      }
    }
  });

  it("Adventurer and Legend have at least one modifier", () => {
    for (const char of ALL_CHARACTERS) {
      for (const diff of difficultyConfigs[char].difficulties) {
        if (diff.id === "difficulty-1") {
          expect(diff.modifiers.length).toBe(0);
        } else {
          expect(diff.modifiers.length).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it("all modifier kinds are valid", () => {
    const validKinds = new Set([
      "enemy-starting-armor", "enemy-gains-forge-each-turn",
      "increase-enemy-physical-damage", "increase-enemy-damage",
      "increase-enemy-status", "enemy-attacks-gain-leech",
      "start-block", "start-max-mana", "gold-multiplier", "start-companion",
      "enemy-health-multiplier", "enemy-damage-multiplier",
    ]);
    for (const char of ALL_CHARACTERS) {
      for (const diff of difficultyConfigs[char].difficulties) {
        for (const mod of diff.modifiers) {
          expect(validKinds.has(mod.kind), `Unknown modifier kind "${mod.kind}" in ${char}/${diff.id}`).toBe(true);
        }
      }
    }
  });
});

describe("DIFFICULTY_ORDER", () => {
  it("lists difficulties in unlock order", () => {
    expect(DIFFICULTY_ORDER).toEqual(["difficulty-1", "difficulty-2", "difficulty-3"]);
  });
});

describe("isDifficultyUnlocked", () => {
  it("difficulty-1 is always unlocked with empty completed list", () => {
    expect(isDifficultyUnlocked("difficulty-1", [])).toBe(true);
  });

  it("difficulty-1 is always unlocked with arbitrary completed list", () => {
    expect(isDifficultyUnlocked("difficulty-1", ["difficulty-2", "difficulty-3"])).toBe(true);
  });

  it("difficulty-2 is locked when nothing is completed", () => {
    expect(isDifficultyUnlocked("difficulty-2", [])).toBe(false);
  });

  it("difficulty-2 is unlocked when difficulty-1 is completed", () => {
    expect(isDifficultyUnlocked("difficulty-2", ["difficulty-1"])).toBe(true);
  });

  it("difficulty-3 is locked when only difficulty-1 is completed", () => {
    expect(isDifficultyUnlocked("difficulty-3", ["difficulty-1"])).toBe(false);
  });

  it("difficulty-3 is unlocked when difficulty-2 is completed", () => {
    expect(isDifficultyUnlocked("difficulty-3", ["difficulty-1", "difficulty-2"])).toBe(true);
  });

  it("difficulty-3 is unlocked when all previous are completed", () => {
    expect(isDifficultyUnlocked("difficulty-3", ["difficulty-1", "difficulty-2", "difficulty-3"])).toBe(true);
  });
});

describe("getDifficultyModifiers", () => {
  it("Novice (d1) has no modifiers on all characters", () => {
    for (const char of ALL_CHARACTERS) {
      const mods = getDifficultyModifiers(char, "difficulty-1");
      expect(mods).toEqual([]);
    }
  });

  it("Adventurer (d2) has +30% HP and damage modifiers on all characters", () => {
    for (const char of ALL_CHARACTERS) {
      const mods = getDifficultyModifiers(char, "difficulty-2");
      expect(mods).toEqual([
        { kind: "enemy-health-multiplier", amount: 1.3 },
        { kind: "enemy-damage-multiplier", amount: 1.3 },
      ]);
    }
  });

  it("Legend (d3) has +60% HP and damage modifiers on all characters", () => {
    for (const char of ALL_CHARACTERS) {
      const mods = getDifficultyModifiers(char, "difficulty-3");
      expect(mods).toEqual([
        { kind: "enemy-health-multiplier", amount: 1.6 },
        { kind: "enemy-damage-multiplier", amount: 1.6 },
      ]);
    }
  });

  it("returns empty array for unknown difficulty ID", () => {
    const mods = getDifficultyModifiers("knight", "difficulty-999" as unknown as Parameters<typeof getDifficultyModifiers>[1]);
    expect(mods).toEqual([]);
  });
});

describe("getGoldMultiplier", () => {
  it("returns 1 when difficulty is null", () => {
    expect(getGoldMultiplier("knight", null)).toBe(1);
  });

  it("returns 1 for Rogue Novice (d1) — no gold modifier", () => {
    expect(getGoldMultiplier("rogue", "difficulty-1")).toBe(1);
  });

  it("returns 1 for difficulties without gold multiplier", () => {
    for (const char of ALL_CHARACTERS) {
      const mult = getGoldMultiplier(char, "difficulty-3");
      expect(mult).toBe(1);
    }
  });
});

describe("getDifficultyXPMultiplier", () => {
  it("returns 1.0 when difficulty is null", () => {
    expect(getDifficultyXPMultiplier(null)).toBe(1.0);
  });

  it("returns 1.0 for Novice (d1)", () => {
    expect(getDifficultyXPMultiplier("difficulty-1")).toBe(1.0);
  });

  it("returns 1.3 for Adventurer (d2)", () => {
    expect(getDifficultyXPMultiplier("difficulty-2")).toBe(1.3);
  });

  it("returns 1.6 for Legend (d3)", () => {
    expect(getDifficultyXPMultiplier("difficulty-3")).toBe(1.6);
  });
});
