import { describe, expect, it } from "vitest";
import {
  difficultyConfigs,
  DIFFICULTY_ORDER,
  isDifficultyUnlocked,
  getDifficultyModifiers,
  getGoldMultiplier,
  type CharacterId,
  type DifficultyModifier,
} from "@/lib/game-data/difficulties";

const ALL_CHARACTERS: CharacterId[] = ["knight", "rogue", "wizard", "ranger"];

describe("difficultyConfigs data integrity", () => {
  it("has configs for all 4 characters", () => {
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

  it("each difficulty has at least one modifier", () => {
    for (const char of ALL_CHARACTERS) {
      for (const diff of difficultyConfigs[char].difficulties) {
        expect(diff.modifiers.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("all modifier kinds are valid", () => {
    const validKinds = new Set([
      "enemy-starting-armor", "enemy-gains-forge-each-turn",
      "increase-enemy-physical-damage", "increase-enemy-damage",
      "increase-enemy-status", "enemy-attacks-gain-leech",
      "start-block", "start-max-mana", "gold-multiplier", "start-companion",
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
  describe("Knight", () => {
    it("Novice (d1) grants 5 start block", () => {
      const mods = getDifficultyModifiers("knight", "difficulty-1");
      expect(mods).toEqual([{ kind: "start-block", amount: 5 }]);
    });

    it("Adventurer (d2) grants 2 enemy starting armor", () => {
      const mods = getDifficultyModifiers("knight", "difficulty-2");
      expect(mods).toEqual([{ kind: "enemy-starting-armor", amount: 2 }]);
    });

    it("Legend (d3) grants enemy forge each turn", () => {
      const mods = getDifficultyModifiers("knight", "difficulty-3");
      expect(mods).toEqual([{ kind: "enemy-gains-forge-each-turn" }]);
    });
  });

  describe("Rogue", () => {
    it("Novice (d1) grants 1.1 gold multiplier", () => {
      const mods = getDifficultyModifiers("rogue", "difficulty-1");
      expect(mods).toEqual([{ kind: "gold-multiplier", amount: 1.1 }]);
    });

    it("Adventurer (d2) increases enemy poison by 2", () => {
      const mods = getDifficultyModifiers("rogue", "difficulty-2");
      expect(mods).toEqual([{ kind: "increase-enemy-status", status: "poison", amount: 2 }]);
    });

    it("Legend (d3) increases enemy bleed by 3", () => {
      const mods = getDifficultyModifiers("rogue", "difficulty-3");
      expect(mods).toEqual([{ kind: "increase-enemy-status", status: "bleed", amount: 3 }]);
    });
  });

  describe("Wizard", () => {
    it("Novice (d1) grants 1 max mana", () => {
      const mods = getDifficultyModifiers("wizard", "difficulty-1");
      expect(mods).toEqual([{ kind: "start-max-mana", amount: 1 }]);
    });

    it("Adventurer (d2) increases enemy burn by 2", () => {
      const mods = getDifficultyModifiers("wizard", "difficulty-2");
      expect(mods).toEqual([{ kind: "increase-enemy-status", status: "burn", amount: 2 }]);
    });

    it("Legend (d3) increases enemy freeze by 3", () => {
      const mods = getDifficultyModifiers("wizard", "difficulty-3");
      expect(mods).toEqual([{ kind: "increase-enemy-status", status: "freeze", amount: 3 }]);
    });
  });

  describe("Ranger", () => {
    it("Novice (d1) grants start companion", () => {
      const mods = getDifficultyModifiers("ranger", "difficulty-1");
      expect(mods).toEqual([{ kind: "start-companion" }]);
    });

    it("Adventurer (d2) increases enemy damage by 2", () => {
      const mods = getDifficultyModifiers("ranger", "difficulty-2");
      expect(mods).toEqual([{ kind: "increase-enemy-damage", amount: 2 }]);
    });

    it("Legend (d3) increases enemy bleed by 3", () => {
      const mods = getDifficultyModifiers("ranger", "difficulty-3");
      expect(mods).toEqual([{ kind: "increase-enemy-status", status: "bleed", amount: 3 }]);
    });
  });

  it("returns empty array for unknown difficulty ID", () => {
    const mods = getDifficultyModifiers("knight", "difficulty-999" as any);
    expect(mods).toEqual([]);
  });
});

describe("getGoldMultiplier", () => {
  it("returns 1 when difficulty is null", () => {
    expect(getGoldMultiplier("knight", null)).toBe(1);
  });

  it("returns 1.1 for Rogue Novice (d1)", () => {
    expect(getGoldMultiplier("rogue", "difficulty-1")).toBe(1.1);
  });

  it("returns 1 for Knight Novice (no gold modifier)", () => {
    expect(getGoldMultiplier("knight", "difficulty-1")).toBe(1);
  });

  it("returns 1 for Wizard Novice (no gold modifier)", () => {
    expect(getGoldMultiplier("wizard", "difficulty-1")).toBe(1);
  });

  it("returns 1 for Ranger Novice (no gold modifier)", () => {
    expect(getGoldMultiplier("ranger", "difficulty-1")).toBe(1);
  });

  it("returns 1 for difficulties without gold multiplier", () => {
    for (const char of ALL_CHARACTERS) {
      const mult = getGoldMultiplier(char, "difficulty-3");
      expect(mult).toBe(1);
    }
  });
});
