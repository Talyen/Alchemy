import { describe, expect, it } from "vitest";
import {
  isDifficultyUnlocked,
  getDifficultyModifiers,
  getGoldMultiplier,
  getDifficultyXPMultiplier,
} from "@/lib/game-data";

describe("isDifficultyUnlocked", () => {
  it("difficulty-1 is always unlocked with empty completed list", () => {
    expect(isDifficultyUnlocked("difficulty-1", [])).toBe(true);
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
});

describe("difficulty modifiers", () => {
  it.each([
    ["difficulty-1", []],
    [
      "difficulty-2",
      [
        { kind: "enemy-health-multiplier", amount: 1.3 },
        { kind: "enemy-damage-multiplier", amount: 1.3 },
      ],
    ],
    [
      "difficulty-3",
      [
        { kind: "enemy-health-multiplier", amount: 2.8 },
        { kind: "enemy-damage-multiplier", amount: 1.6 },
      ],
    ],
  ] as const)("resolves the shared %s combat modifiers", (difficulty, expected) => {
    expect(getDifficultyModifiers("knight", difficulty)).toEqual(expected);
  });

  it("returns empty modifiers for an unknown difficulty", () => {
    expect(getDifficultyModifiers("knight", "difficulty-999" as Parameters<typeof getDifficultyModifiers>[1])).toEqual(
      [],
    );
  });

  it("defaults Gold scaling when no modifier is present", () => {
    expect(getGoldMultiplier("knight", null)).toBe(1);
    expect(getGoldMultiplier("knight", "difficulty-3")).toBe(1);
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
