import { describe, expect, it, vi, afterEach } from "vitest";
import { dealDamageToEnemy } from "@/lib/battle/damage";
import type { BattleCardEffect } from "@/lib/game-data";
import { patchBattleState } from "../../fixtures/battle";
import { defaultTalentEffects } from "../../fixtures/default-battle-state";
import { makeCard, makeEffect, makeTexts } from "./damage-test-helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("computeBaseDamage — bleed damage", () => {
  it("applies bleed desperate multiplier when player below half health", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: { ...defaultTalentEffects, bleedDesperateMultiplier: 1.5 },
    });
    const card = makeCard({ effects: [makeEffect("bleed", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThan(30);
  });

  it("applies bleed execute threshold multiplier", () => {
    const state = patchBattleState({
      enemyHealth: 5,
      enemyMaxHealth: 30,
      talentEffects: { ...defaultTalentEffects, bleedExecuteThreshold: 25 },
    });
    const card = makeCard({ effects: [makeEffect("bleed", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(0);
  });
});
