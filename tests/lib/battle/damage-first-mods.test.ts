import { describe, expect, it } from "vitest";
import { dealDamageToEnemy } from "@/lib/battle/damage";
import type { BattleCardEffect } from "@/lib/game-data";
import { patchBattleState } from "../../fixtures/battle";
import { defaultTalentEffects, defaultTrinketManifest, defaultCombatFlags } from "../../fixtures/default-battle-state";
import { makeCombatTexts, makeEffect, makeTestCard } from "../../fixtures/battle";

describe("applyFirstDamageModifiers", () => {
  it("increases first burn card damage by 50% when Wildfire talent active", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      talentEffects: { ...defaultTalentEffects, firstBurnCardBonusMultiplier: 1.5 },
    });
    const card = makeTestCard({ effects: [makeEffect("burn", 5)] });
    const texts = makeCombatTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.flags.firstBurnCardDoubledUsed).toBe(true);
    expect(result.enemyHealth).toBe(22);
  });

  it("does not boost second burn card when Wildfire flag is used", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      talentEffects: { ...defaultTalentEffects, firstBurnCardBonusMultiplier: 1.5 },
      flags: defaultCombatFlags({ firstBurnCardDoubledUsed: true }),
    });
    const card = makeTestCard({ effects: [makeEffect("burn", 5)] });
    const texts = makeCombatTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.flags.firstBurnCardDoubledUsed).toBe(true);
    expect(result.enemyHealth).toBe(25);
  });

  it("does not consume Wildfire when the multiplier is identity", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      talentEffects: { ...defaultTalentEffects, firstBurnCardBonusMultiplier: 1 },
    });
    const card = makeTestCard({ effects: [makeEffect("burn", 5)] });
    const texts = makeCombatTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.flags.firstBurnCardDoubledUsed).toBe(false);
    expect(result.enemyHealth).toBe(25);
  });

  it("doubles first burn damage via boon effect", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      trinketEffects: defaultTrinketManifest({ firstBurnDoubled: true }),
    });
    const card = makeTestCard({ effects: [makeEffect("burn", 5)] });
    const texts = makeCombatTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.flags.firstBurnTrinketDoubledUsed).toBe(true);
  });

  it("doubles first holy damage when boon effect active", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      trinketEffects: defaultTrinketManifest({ firstHolyDamageDoubled: true }),
    });
    const card = makeTestCard({ effects: [makeEffect("holy", 5)] });
    const texts = makeCombatTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.flags.firstHolyDamageBonusUsed).toBe(true);
  });
});
