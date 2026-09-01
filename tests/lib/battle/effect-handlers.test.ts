import { describe, expect, it } from "vitest";
import type { CombatTextEvent } from "@/lib/battle/types";
import { applySummonCompanionEffect, applyBuffCompanionEffect } from "@/lib/battle/effect-handlers/simple-handlers";
import {
  applySelfDamageEffect,
  applyDamageEffect,
  applyRandomDamageEffect,
  applyRemoveEnemyArmorEffect,
} from "@/lib/battle/effect-handlers/damage-handlers";
import {
  applyPlayerStatusEffectHandler,
  applyEnemyStatusEffect,
  applyRemovePlayerStatusEffect,
  applyMultiplyEnemyStatusEffect,
  applyCleansePlayerStatusToDamageEffect,
  applyRemoveHarmfulStatusEffect,
} from "@/lib/battle/effect-handlers/status-handlers";
import {
  applyRestoreManaEffect,
  applyLoseManaEffect,
  applyGainMaxManaEffect,
  applyLoseMaxManaEffect,
  applyHealEffect,
  applyLoseHealthEffect,
} from "@/lib/battle/effect-handlers/mana-health-handlers";
import {
  applyGainGoldEffect,
  applyWishEffectHandler,
  applyDrawCardsEffect,
} from "@/lib/battle/effect-handlers/simple-handlers";
import { makeTestBattleState } from "../../fixtures/battle";

type EffectHandler = (
  state: ReturnType<typeof makeTestBattleState>,
  card: never,
  effect: never,
  multiplier: number,
  texts: CombatTextEvent[],
) => unknown;

describe("effect handlers reject mismatched kinds", () => {
  it.each([
    { name: "applySummonCompanionEffect", apply: applySummonCompanionEffect },
    { name: "applyBuffCompanionEffect", apply: applyBuffCompanionEffect },
    { name: "applyDamageEffect", apply: applyDamageEffect },
    { name: "applySelfDamageEffect", apply: applySelfDamageEffect },
    { name: "applyRandomDamageEffect", apply: applyRandomDamageEffect },
    { name: "applyRemoveEnemyArmorEffect", apply: applyRemoveEnemyArmorEffect },
    { name: "applyRestoreManaEffect", apply: applyRestoreManaEffect },
    { name: "applyLoseManaEffect", apply: applyLoseManaEffect },
    { name: "applyGainMaxManaEffect", apply: applyGainMaxManaEffect },
    { name: "applyLoseMaxManaEffect", apply: applyLoseMaxManaEffect },
    { name: "applyHealEffect", apply: applyHealEffect },
    { name: "applyLoseHealthEffect", apply: applyLoseHealthEffect },
    { name: "applyPlayerStatusEffectHandler", apply: applyPlayerStatusEffectHandler },
    { name: "applyEnemyStatusEffect", apply: applyEnemyStatusEffect },
    { name: "applyRemoveHarmfulStatusEffect", apply: applyRemoveHarmfulStatusEffect },
    { name: "applyRemovePlayerStatusEffect", apply: applyRemovePlayerStatusEffect },
    { name: "applyMultiplyEnemyStatusEffect", apply: applyMultiplyEnemyStatusEffect },
    { name: "applyCleansePlayerStatusToDamageEffect", apply: applyCleansePlayerStatusToDamageEffect },
    { name: "applyGainGoldEffect", apply: applyGainGoldEffect },
    { name: "applyWishEffectHandler", apply: applyWishEffectHandler },
    { name: "applyDrawCardsEffect", apply: applyDrawCardsEffect },
  ] as const)("$name throws for a mismatched kind", ({ apply }) => {
    const state = makeTestBattleState();
    expect(() => (apply as EffectHandler)(state, {} as never, { kind: "__never__" } as never, 1, [])).toThrow();
  });
});

describe("applySelfDamageEffect", () => {
  it("does not grant rider status when Death's Door absorbs the full hit", () => {
    const state = makeTestBattleState({
      playerHealth: 1,
      playerMaxHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, burn: 0 },
    });
    const texts: CombatTextEvent[] = [];
    const result = applySelfDamageEffect(
      state,
      {} as never,
      { kind: "self-damage", damageType: "burn", amount: 5 } as never,
      1,
      texts,
    );
    expect(result.playerHealth).toBe(1);
    expect(result.playerStatuses.burn).toBe(0);
    expect(result.deathsDoorActive).toBe(true);
  });
});

describe("applyPlayerStatusEffectHandler", () => {
  it("applies perManaCrystal scaling", () => {
    const state = makeTestBattleState({ maxMana: 5 });
    const result = applyPlayerStatusEffectHandler(
      state,
      {} as never,
      { kind: "player-status", status: "block", amount: 2, perManaCrystal: 2 } as never,
      1,
      [],
    );
    expect(result.playerStatuses.block).toBe(10);
  });

  it("converts current mana as block per mana and zeroes mana", () => {
    const state = makeTestBattleState({ mana: 4, maxMana: 5 });
    const result = applyPlayerStatusEffectHandler(
      state,
      {} as never,
      { kind: "player-status", status: "block", amount: 0, convertCurrentMana: 3 } as never,
      1,
      [],
    );
    expect(result.playerStatuses.block).toBe(12);
    expect(result.mana).toBe(0);
  });

  it("respects potion multiplier on convertCurrentMana", () => {
    const state = makeTestBattleState({ mana: 4, maxMana: 5 });
    const result = applyPlayerStatusEffectHandler(
      state,
      {} as never,
      { kind: "player-status", status: "block", amount: 0, convertCurrentMana: 3 } as never,
      2,
      [],
    );
    expect(result.playerStatuses.block).toBe(24);
  });

  it("uses frozen manaAtStart snapshot, not live mana", () => {
    const state = makeTestBattleState({ mana: 4, maxMana: 5 });
    const result = applyPlayerStatusEffectHandler(
      state,
      {} as never,
      { kind: "player-status", status: "block", amount: 0, convertCurrentMana: 3 } as never,
      1,
      [],
      { manaAtStart: 6, enemyFreezeSkipTurnsAtStart: 0 },
    );
    expect(result.playerStatuses.block).toBe(18);
  });
});

describe("applyEnemyStatusEffect", () => {
  it("applies freeze and triggers freeze resolution", () => {
    const texts: CombatTextEvent[] = [];
    const state = makeTestBattleState({
      enemyStatuses: { ...makeTestBattleState().enemyStatuses, freeze: 0 },
      enemyCC: { freezeSkipTurns: 0, stunSkipTurns: 0, cooldown: 0 },
    });
    const result = applyEnemyStatusEffect(
      state,
      {} as never,
      { kind: "enemy-status", status: "freeze", amount: 3 } as never,
      1,
      texts,
    );
    expect(result.enemyStatuses.freeze).toBe(3);
  });

  it("applies stun and triggers stun resolution", () => {
    const texts: CombatTextEvent[] = [];
    const state = makeTestBattleState();
    const result = applyEnemyStatusEffect(
      state,
      {} as never,
      { kind: "enemy-status", status: "stun", amount: 2 } as never,
      1,
      texts,
    );
    expect(result.enemyStatuses.stun).toBeGreaterThanOrEqual(2);
  });
});

describe("applyRemovePlayerStatusEffect", () => {
  it("removes player status and applies heals from trinkets and talents", () => {
    const state = makeTestBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, burn: 5 },
      trinketEffects: { ...makeTestBattleState().trinketEffects, sinEaterHealOnHarmfulStatusRemove: 3 },
      talentEffects: { ...makeTestBattleState().talentEffects, healOnStatusCleanse: 2 },
    });
    const result = applyRemovePlayerStatusEffect(
      state,
      {} as never,
      { kind: "remove-player-status", status: "burn" } as never,
      1,
      [],
    );
    expect(result.playerStatuses.burn).toBe(0);
    expect(result.playerHealth).toBe(15);
  });

  it("no-ops when player has 0 stacks of the status", () => {
    const state = makeTestBattleState({
      playerStatuses: { ...makeTestBattleState().playerStatuses, burn: 0 },
    });
    const result = applyRemovePlayerStatusEffect(
      state,
      {} as never,
      { kind: "remove-player-status", status: "burn" } as never,
      1,
      [],
    );
    expect(result).toBe(state);
  });
});

describe("applyMultiplyEnemyStatusEffect", () => {
  it("no-ops when current status is 0", () => {
    const state = makeTestBattleState({
      enemyStatuses: { ...makeTestBattleState().enemyStatuses, poison: 0 },
    });
    const result = applyMultiplyEnemyStatusEffect(
      state,
      {} as never,
      { kind: "multiply-enemy-status", status: "poison", factor: 2 } as never,
      1,
      [],
    );
    expect(result).toBe(state);
  });

  it("multiplies enemy status and triggers freeze resolution", () => {
    const state = makeTestBattleState({
      enemyStatuses: { ...makeTestBattleState().enemyStatuses, freeze: 4 },
    });
    const result = applyMultiplyEnemyStatusEffect(
      state,
      {} as never,
      { kind: "multiply-enemy-status", status: "freeze", factor: 3 } as never,
      1,
      [],
    );
    expect(result.enemyStatuses.freeze).toBe(12);
  });
});

describe("applyCleansePlayerStatusToDamageEffect", () => {
  it("no-ops when player has 0 stacks", () => {
    const state = makeTestBattleState();
    const result = applyCleansePlayerStatusToDamageEffect(
      state,
      {} as never,
      { kind: "cleanse-player-status-to-damage", status: "burn", damageType: "physical" } as never,
      1,
      [],
    );
    expect(result).toBe(state);
  });

  it("cleanses status and deals damage", () => {
    const state = makeTestBattleState({
      playerStatuses: { ...makeTestBattleState().playerStatuses, burn: 5 },
      enemyHealth: 30,
    });
    const result = applyCleansePlayerStatusToDamageEffect(
      state,
      {} as never,
      { kind: "cleanse-player-status-to-damage", status: "burn", damageType: "physical" } as never,
      1,
      [],
    );
    expect(result.playerStatuses.burn).toBe(0);
    expect(result.enemyHealth).toBe(25);
  });
});

describe("applyRestoreManaEffect ifEnemyFrozen", () => {
  it("no-ops when enemy not frozen and ifEnemyFrozen set", () => {
    const state = makeTestBattleState({ enemyCC: { freezeSkipTurns: 0, stunSkipTurns: 0, cooldown: 0 } });
    const result = applyRestoreManaEffect(
      state,
      {} as never,
      { kind: "restore-mana", amount: 2, ifEnemyFrozen: true } as never,
      1,
      [],
      { manaAtStart: 0, enemyFreezeSkipTurnsAtStart: 0 },
    );
    expect(result).toBe(state);
  });

  it("restores when enemy frozen at start", () => {
    const state = makeTestBattleState({ mana: 1, enemyCC: { freezeSkipTurns: 2, stunSkipTurns: 0, cooldown: 0 } });
    const result = applyRestoreManaEffect(
      state,
      {} as never,
      { kind: "restore-mana", amount: 2, ifEnemyFrozen: true } as never,
      1,
      [],
      { manaAtStart: 1, enemyFreezeSkipTurnsAtStart: 1 },
    );
    expect(result.mana).toBeGreaterThan(1);
  });
});
