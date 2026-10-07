import { describe, expect, it } from "vitest";
import { patchBattleState } from "../../fixtures/battle";
import { dealDamage, makeCombatTexts, makeEffect, makeTestCard } from "../../fixtures/battle";
import { applyLifestealAndPlayerHitTriggers } from "@/lib/battle/follow-up-hit-resolution";

describe("dealDamageToEnemy — lifesteal", () => {
  it.each([
    [5, 1],
    [10, 0.5],
  ])("rounds damage %i Leech and its healing multiplier %s separately", (damage, multiplier) => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerHealth: 20,
      talentEffects: { healMultiplier: multiplier },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", damage, { lifesteal: true })] });
    const texts = makeCombatTexts();
    const result = dealDamage(state, card, texts);
    expect(result.playerHealth).toBe(23);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 3 });
    expect(state.playerHealth).toBe(20);
  });
});

describe("low-health Leech bonuses", () => {
  it.each([14, 15, 16])("requires strictly below half Health at %s/30", (health) => {
    const desperate = patchBattleState({
      playerHealth: health,
      playerMaxHealth: 30,
      talentEffects: { leechDesperateMultiplier: 20 },
    });
    expect(applyLifestealAndPlayerHitTriggers(desperate, 10, []).playerHealth - health).toBe(health < 15 ? 6 : 5);
  });
});
