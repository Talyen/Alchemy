import { describe, expect, it } from "vitest";
import {
  applyPlayerDamageStatuses,
  getEnemyDamageMultiplier,
  removeHarmfulPlayerStatuses,
} from "@/lib/battle/status-effects";
import { makeTestBattleState } from "../../fixtures/battle";
import { defaultPlayerStatusValues, defaultTalentEffects, defaultCcState } from "../../fixtures/default-battle-state";

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
});

describe("status-effects re-exports", () => {
  it("applyPlayerDamageStatuses adds burn stacks from enemy burn damage", () => {
    const state = makeTestBattleState({
      playerStatuses: defaultPlayerStatusValues({ ...makeTestBattleState().playerStatuses, burn: 1 }),
    });
    const result = applyPlayerDamageStatuses(state, { damageType: "burn" }, 4);
    expect(result.playerStatuses.burn).toBe(5);
  });

  it("applyPlayerDamageStatuses is a no-op at zero damage", () => {
    const state = makeTestBattleState({
      playerStatuses: defaultPlayerStatusValues({ ...makeTestBattleState().playerStatuses, poison: 2 }),
    });
    const result = applyPlayerDamageStatuses(state, { damageType: "poison" }, 0);
    expect(result).toBe(state);
  });

  it("removeHarmfulPlayerStatuses clears highest-priority harmful stacks", () => {
    const state = makeTestBattleState({
      playerStatuses: defaultPlayerStatusValues({ ...makeTestBattleState().playerStatuses, burn: 3, bleed: 2 }),
    });
    const result = removeHarmfulPlayerStatuses(state, 1);
    expect(result.playerStatuses.burn).toBe(0);
    expect(result.playerStatuses.bleed).toBe(2);
  });
});
