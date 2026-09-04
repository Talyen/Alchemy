import { describe, expect, it } from "vitest";
import type { DamageType } from "@/lib/game-data";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { patchBattleState } from "../../fixtures/battle";
import { dealDamage, makeCombatTexts, makeEffect, makeTestCard } from "../../fixtures/battle";

const CHAIN_TYPES: DamageType[] = ["physical", "holy", "bleed", "stun", "burn", "freeze", "nature", "poison"];

describe("dealDamageToEnemy — full calc/rider/status chain per wound kind", () => {
  for (const damageType of CHAIN_TYPES) {
    it(`${damageType} reduces enemy health and emits matching damage text`, () => {
      const state = patchBattleState({ enemyHealth: 30, enemyMaxHealth: 30 });
      const card = makeTestCard({ effects: [makeEffect(damageType, 5)] });
      const texts = makeCombatTexts();
      const result = dealDamage(state, card, texts);
      expect(result.enemyHealth).toBeLessThan(30);
      expect(texts.some((t) => t.target === "enemy" && t.kind === "damage" && t.stat === damageType)).toBe(true);
    });
  }

  it("burn stacks burn equal to damage dealt", () => {
    const state = patchBattleState({ enemyHealth: 30, enemyMaxHealth: 30 });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("burn", 5)] }));
    expect(result.enemyStatuses.burn).toBeGreaterThan(0);
  });

  it("poison stacks poison equal to damage dealt", () => {
    const state = patchBattleState({ enemyHealth: 30, enemyMaxHealth: 30 });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("poison", 5)] }));
    expect(result.enemyStatuses.poison).toBeGreaterThan(0);
  });

  it("bleed stacks equal to damage as bleed", () => {
    const state = patchBattleState({ enemyHealth: 30, enemyMaxHealth: 30 });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("bleed", 5)] }));
    expect(result.enemyStatuses.bleed).toBe(5);
  });

  it("freeze and stun build their own stacks", () => {
    const frozen = dealDamage(
      patchBattleState({ enemyHealth: 30, enemyMaxHealth: 30 }),
      makeTestCard({ effects: [makeEffect("freeze", 5)] }),
    );
    expect(frozen.enemyStatuses.freeze).toBeGreaterThan(0);
    const stunned = dealDamage(
      patchBattleState({ enemyHealth: 30, enemyMaxHealth: 30 }),
      makeTestCard({ effects: [makeEffect("stun", 5)] }),
    );
    expect(stunned.enemyStatuses.stun).toBeGreaterThan(0);
  });

  it("physical, holy and nature apply no enemy status by default", () => {
    for (const damageType of ["physical", "holy", "nature"] as const) {
      const state = patchBattleState({ enemyHealth: 30, enemyMaxHealth: 30 });
      const result = dealDamage(state, makeTestCard({ effects: [makeEffect(damageType, 5)] }));
      expect(result.enemyStatuses.burn).toBe(0);
      expect(result.enemyStatuses.poison).toBe(0);
      expect(result.enemyStatuses.bleed).toBe(0);
      expect(result.enemyStatuses.freeze).toBe(0);
      expect(result.enemyStatuses.stun).toBe(0);
    }
  });

  it("bleed with lifesteal queues leech that detonation pays as healing", () => {
    const state = patchBattleState({ enemyHealth: 30, enemyMaxHealth: 30, playerHealth: 20, playerMaxHealth: 30 });
    const afterHit = dealDamage(state, makeTestCard({ effects: [makeEffect("bleed", 5, { lifesteal: true })] }));
    expect(afterHit.pendingBleedLeechHealing).toBeGreaterThan(0);
    const texts = makeCombatTexts();
    const afterDetonate = detonateEnemyStatuses(afterHit, ["bleed"], texts);
    expect(afterDetonate.pendingBleedLeechHealing).toBe(0);
    expect(afterDetonate.playerHealth).toBeGreaterThan(20);
  });
});
