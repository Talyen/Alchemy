import { describe, expect, it } from "vitest";
import { getEnemyDamageMultiplier } from "@/lib/battle/status-helpers";
import { TRAIT_DAMAGE_RULES } from "@/lib/game-constants";
import { makeTestBattleState } from "../../fixtures/battle";
import { defaultTalentEffects, defaultCcState } from "../../fixtures/default-battle-state";

describe("getEnemyDamageMultiplier", () => {
  it("returns 1 when no multipliers apply", () => {
    const state = makeTestBattleState();
    const result = getEnemyDamageMultiplier(state, "physical");
    expect(result).toBe(1);
  });

  it("returns TRAIT_DAMAGE_WEAKNESS when stunDoubleDamage is active and enemy is stunned", () => {
    const state = makeTestBattleState({
      enemyCC: defaultCcState({ stunSkipTurns: 1 }),
      talentEffects: { ...defaultTalentEffects, ...makeTestBattleState().talentEffects, stunDoubleDamage: true },
    });
    const result = getEnemyDamageMultiplier(state, "physical");
    expect(result).toBe(2);
  });

  it("returns TRAIT_DAMAGE_WEAKNESS when freezeDoubleDamage is active and enemy is frozen", () => {
    const state = makeTestBattleState({
      enemyCC: defaultCcState({ freezeSkipTurns: 1 }),
      talentEffects: { ...defaultTalentEffects, ...makeTestBattleState().talentEffects, freezeDoubleDamage: true },
    });
    const result = getEnemyDamageMultiplier(state, "physical");
    expect(result).toBe(2);
  });

  it("returns 4x when both stun and freeze double damage are active", () => {
    const state = makeTestBattleState({
      enemyCC: defaultCcState({ stunSkipTurns: 1, freezeSkipTurns: 1 }),
      talentEffects: {
        ...defaultTalentEffects,
        ...makeTestBattleState().talentEffects,
        stunDoubleDamage: true,
        freezeDoubleDamage: true,
      },
    });
    const result = getEnemyDamageMultiplier(state, "physical");
    expect(result).toBe(4);
  });

  it("trait weakness takes priority over stun/freeze multipliers", () => {
    const state = makeTestBattleState({
      enemyCC: defaultCcState({ stunSkipTurns: 1, freezeSkipTurns: 1 }),
      talentEffects: {
        ...defaultTalentEffects,
        ...makeTestBattleState().talentEffects,
        stunDoubleDamage: true,
        freezeDoubleDamage: true,
      },
      currentEnemy: {
        id: "brittle-skeleton",
        title: "Brittle Skeleton",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "brittle-bones", title: "Brittle Bones", description: "Weak to Holy" }],
        attackEffects: [],
      },
    });
    const result = getEnemyDamageMultiplier(state, "holy");
    expect(result).toBe(2);
  });

  it("applies every TRAIT_DAMAGE_RULES multiplier", () => {
    const base = makeTestBattleState();
    for (const rule of TRAIT_DAMAGE_RULES) {
      const state = makeTestBattleState({
        currentEnemy: {
          ...base.currentEnemy,
          traits: [{ id: rule.traitId, title: rule.traitId, description: "" }],
        },
      });
      expect(getEnemyDamageMultiplier(state, rule.damageType), rule.traitId).toBe(rule.multiplier);
    }
  });
});
