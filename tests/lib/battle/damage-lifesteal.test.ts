import { describe, expect, it, vi, afterEach } from "vitest";
import { dealDamageToEnemy } from "@/lib/battle/damage";
import type { BattleCardEffect } from "@/lib/game-data";
import { patchBattleState } from "../../fixtures/battle";
import { defaultTalentEffects } from "../../fixtures/default-battle-state";
import { makeCard, makeEffect, makeTexts } from "./damage-test-helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dealDamageToEnemy — lifesteal", () => {
  it("heals player when effect has lifesteal", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({
      playerHealth: 20,
      gold: 50,
      talentEffects: { ...defaultTalentEffects, healMultiplier: 0.5 },
    });
    const card = makeCard({ effects: [makeEffect("physical", 10, { lifesteal: true })] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerHealth).toBe(23);
  });
});
