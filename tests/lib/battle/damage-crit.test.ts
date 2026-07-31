import { describe, expect, it, vi, afterEach } from "vitest";
import { dealDamageToEnemy } from "@/lib/battle/damage";
import type { BattleCardEffect } from "@/lib/game-data";
import { CRIT_MULTIPLIER } from "@/lib/game-constants";
import { patchBattleState } from "../../fixtures/battle";
import { defaultTalentEffects } from "../../fixtures/default-battle-state";
import { makeCard, makeEffect, makeTexts } from "./damage-test-helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("applyCrit", () => {
  it("applies crit multiplier when random rolls below threshold", () => {
    const state = patchBattleState({
      talentEffects: { ...defaultTalentEffects, physicalCritChance: 0 },
      rng: () => 0.01,
    });
    const card = makeCard({ effects: [makeEffect("physical", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(30 - Math.floor(10 * CRIT_MULTIPLIER));
  });

  it("stacks physical crit chance with global crit chance", () => {
    const state = patchBattleState({
      talentEffects: { ...defaultTalentEffects, physicalCritChance: 10 },
      rng: () => 0.1,
    });
    const card = makeCard({ effects: [makeEffect("physical", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(30 - Math.floor(10 * CRIT_MULTIPLIER));
  });

  it("does not crit when random is above threshold", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState();
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(25);
  });
});
