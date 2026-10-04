import { describe, expect, it } from "vitest";
import { cardById } from "@/lib/game-data";
import { getTalentById } from "@/lib/game-data/talents/talent-pool-definitions";
import { dealDamage, patchBattleState } from "../../fixtures/battle";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { resolveFollowUpHit } from "@/lib/battle/follow-up-hit-resolution";

describe("talent help describes the supported source", () => {
  it("Sanguine explains that hits arm Bleed Leech, rather than promising a new roll on each tick", () => {
    const state = patchBattleState({
      playerHealth: 10,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { bleed: 6 },
      talentEffects: { bleedLeechChance: 100 },
      rng: () => 0.99,
    });
    expect(tickEnemyStatuses(state, []).playerHealth).toBe(10);
    const hit = dealDamage(state, cardById["serrated-arrowhead"]!);
    expect(hit.pendingBleedLeechHealing).toBeGreaterThan(0);
    expect(tickEnemyStatuses(hit, []).playerHealth).toBeGreaterThan(10);
    expect(getTalentById("bleed-leech-chance")?.description).toMatch(/Bleed hits/);
  });
  it("Blessed Leech does not promise healing from every Holy counterattack", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 40,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      talentEffects: { holyLifestealPercent: 50 },
      rng: () => 0.99,
    });
    expect(dealDamage(state, cardById.tithe!).playerHealth).toBeGreaterThan(10);
    expect(
      resolveFollowUpHit(state, { source: "player-follow-up", damageType: "holy", amount: 4 }, []).playerHealth,
    ).toBe(10);
    expect(getTalentById("holy-lifesteal")?.description).toMatch(/Holy card hits/);
  });
});
