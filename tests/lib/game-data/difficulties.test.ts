import { describe, expect, it } from "vitest";
import {
  DIFFICULTY_ORDER,
  enemyById,
  getDifficultyModifiers,
  getDifficultyXPMultiplier,
  isDifficultyUnlocked,
} from "@/lib/game-data";
import { createBattleStartState } from "@/lib/battle/battle-setup";
import { createSeededRng } from "@/lib/rng";

describe("difficulty progression", () => {
  it("opens only the first tier or a tier whose immediate predecessor is complete", () => {
    for (const [index, difficulty] of DIFFICULTY_ORDER.entries()) {
      expect(isDifficultyUnlocked(difficulty, []), difficulty).toBe(index === 0);
      if (index === 0) continue;
      const previous = DIFFICULTY_ORDER[index - 1]!;
      expect(isDifficultyUnlocked(difficulty, [previous]), difficulty).toBe(true);
      expect(
        isDifficultyUnlocked(
          difficulty,
          DIFFICULTY_ORDER.filter((id) => id !== previous),
        ),
        difficulty,
      ).toBe(false);
    }
  });

  it("applies selected difficulty to actual enemy Health and keeps XP progression aligned", () => {
    const enemy = enemyById.skeleton!;
    const start = (difficulty: (typeof DIFFICULTY_ORDER)[number]) =>
      createBattleStartState({
        currentEnemy: enemy,
        runDeck: [],
        difficultyModifiers: getDifficultyModifiers("knight", difficulty),
        rng: createSeededRng(1),
        appliesFightPacing: false,
      });
    const novice = start("difficulty-1");
    expect(start("difficulty-2").enemyMaxHealth).toBe(Math.round(novice.enemyMaxHealth * 1.3));
    expect(start("difficulty-3").enemyMaxHealth).toBe(Math.round(novice.enemyMaxHealth * 2.8));
    expect(DIFFICULTY_ORDER.map(getDifficultyXPMultiplier)).toEqual([1, 1.3, 1.6]);
  });
});
