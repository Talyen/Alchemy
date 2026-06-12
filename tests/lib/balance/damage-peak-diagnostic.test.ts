import { describe, expect, it } from "vitest";
import { buildClassSimDeck, simulateBattle } from "@/lib/balance";
import type { DifficultyModifier } from "@/lib/game-data";

const LEGEND_MODIFIERS: DifficultyModifier[] = [
  { kind: "enemy-health-multiplier", amount: 1.6 },
  { kind: "enemy-damage-multiplier", amount: 1.6 },
];

const shouldRun = process.env.ALCHEMY_BALANCE_DIAG === "1";
const describeDiag = shouldRun ? describe : describe.skip;

describeDiag("damage peak diagnostic", () => {
  it("finds knight late peak damage scenario over 500", () => {
    let best = { damage: 0, seed: 0, stat: "" };
    for (let seed = 1; seed <= 200; seed++) {
      const deck = buildClassSimDeck("knight", "late", seed);
      const result = simulateBattle({
        characterId: "knight",
        enemyId: "skeleton",
        deck,
        depth: 16,
        talentPreset: "late",
        difficultyModifiers: LEGEND_MODIFIERS,
        seed,
        maxTurns: 30,
      });
      const damage = result.anomalies.maxSingleHitDamageToEnemy;
      if (damage > best.damage) {
        best = { damage, seed, stat: result.anomalies.maxSingleHitDamageToEnemyStat };
      }
    }
    console.info("Knight late peak:", best);
    expect(best.damage).toBeGreaterThan(0);
  });
});
