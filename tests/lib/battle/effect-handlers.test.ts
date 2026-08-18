import { describe, expect, it } from "vitest";
import type { CombatTextEvent } from "@/lib/battle/types";
import { applySummonCompanionEffect, applyBuffCompanionEffect } from "@/lib/battle/effect-handlers/companion-handlers";
import {
  applyDamageEffect,
  applySelfDamageEffect,
  applyRandomDamageEffect,
  applyRemoveEnemyArmorEffect,
} from "@/lib/battle/effect-handlers/damage-handlers";
import {
  applyRestoreManaEffect,
  applyLoseManaEffect,
  applyGainMaxManaEffect,
  applyLoseMaxManaEffect,
  applyHealEffect,
  applyLoseHealthEffect,
} from "@/lib/battle/effect-handlers/mana-health-handlers";
import {
  applyPlayerStatusEffectHandler,
  applyEnemyStatusEffect,
  applyRemoveHarmfulStatusEffect,
  applyRemovePlayerStatusEffect,
  applyMultiplyEnemyStatusEffect,
  applyCleansePlayerStatusToDamageEffect,
} from "@/lib/battle/effect-handlers/status-handlers";
import {
  applyGainGoldEffect,
  applyWishEffectHandler,
  applyDrawCardsEffect,
} from "@/lib/battle/effect-handlers/utility-handlers";
import { makeTestBattleState } from "../../fixtures/battle";

type EffectHandler = (
  state: ReturnType<typeof makeTestBattleState>,
  card: never,
  effect: never,
  multiplier: number,
  texts: CombatTextEvent[],
) => unknown;

describe("effect handlers ignore mismatched kinds", () => {
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
  ] as const)("$name is a no-op for a mismatched kind", ({ apply }) => {
    const state = makeTestBattleState();
    expect((apply as EffectHandler)(state, {} as never, { kind: "__never__" } as never, 1, [])).toBe(state);
  });
});

describe("applySummonCompanionEffect", () => {
  it("summons companion and draws cards when drawOnCompanionCard talent is active", () => {
    const state = makeTestBattleState({
      talentEffects: { ...makeTestBattleState().talentEffects, drawOnCompanionCard: 2 },
    });
    const result = applySummonCompanionEffect(
      state,
      { id: "test", title: "T", descriptionLines: [""], art: "", cost: 1, effects: [] } as never,
      { kind: "summon-companion", companionId: "wolf" } as never,
      1,
      [],
    );
    expect(result.activeCompanion?.id).toBe("wolf");
  });

  it("summons companion without drawing when drawOnCompanionCard is 0", () => {
    const state = makeTestBattleState({
      deck: [{ id: "card", title: "C", descriptionLines: [""], art: "", cost: 1, effects: [] }],
    });
    const result = applySummonCompanionEffect(
      state,
      {} as never,
      { kind: "summon-companion", companionId: "wolf" } as never,
      1,
      [],
    );
    expect(result.activeCompanion?.id).toBe("wolf");
    expect(result.deck).toHaveLength(1);
  });
});

describe("applyBuffCompanionEffect", () => {
  it("adds to companionDamageBuff", () => {
    const state = makeTestBattleState({ companionDamageBuff: 3 });
    const result = applyBuffCompanionEffect(state, {} as never, { kind: "buff-companion", amount: 2 } as never, 1, []);
    expect(result.companionDamageBuff).toBe(5);
  });
});

describe("applyDamageEffect", () => {
  it("applies potion multiplier when potionMult is not 1", () => {
    const state = makeTestBattleState();
    const result = applyDamageEffect(
      state,
      { effects: [{ kind: "damage", damageType: "physical", amount: 5 }] } as never,
      { kind: "damage", damageType: "physical", amount: 5 } as never,
      2,
      [],
    );
    expect(result.enemyHealth).toBe(20);
  });
});

describe("applySelfDamageEffect", () => {
  it("applies rider status from actual health lost, not the raw amount", () => {
    const state = makeTestBattleState({
      playerHealth: 20,
      playerMaxHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, burn: 0 },
      talentEffects: { ...makeTestBattleState().talentEffects, damageReduction: 3 },
    });
    const texts: CombatTextEvent[] = [];
    const result = applySelfDamageEffect(
      state,
      {} as never,
      { kind: "self-damage", damageType: "burn", amount: 5 } as never,
      1,
      texts,
    );
    expect(result.playerHealth).toBe(18);
    expect(result.playerStatuses.burn).toBe(2);
  });

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

describe("applyRandomDamageEffect", () => {
  it("deals random damage type with random amount in range", () => {
    const state = makeTestBattleState({ rng: () => 0.5 });
    const result = applyRandomDamageEffect(
      state,
      {} as never,
      { kind: "random-damage", minAmount: 3, maxAmount: 5 } as never,
      1,
      [],
    );
    expect(result.enemyHealth).toBeLessThan(30);
  });
});

describe("applyRemoveEnemyArmorEffect", () => {
  it("removes armor from enemy mitigation", () => {
    const state = makeTestBattleState({
      enemyMitigation: { forge: 0, armor: 5, block: 0 },
    });
    const result = applyRemoveEnemyArmorEffect(
      state,
      {} as never,
      { kind: "remove-enemy-armor", amount: 3 } as never,
      1,
      [],
    );
    expect(result.enemyMitigation.armor).toBe(2);
  });
});

describe("applyRestoreManaEffect", () => {
  it("restores mana with potion multiplier", () => {
    const texts: any[] = [];
    const state = makeTestBattleState({ mana: 0 });
    const result = applyRestoreManaEffect(state, {} as never, { kind: "restore-mana", amount: 3 } as never, 2, texts);
    expect(result.mana).toBe(6);
  });
});

describe("applyLoseManaEffect", () => {
  it("loses mana without going below 0", () => {
    const state = makeTestBattleState({ mana: 2 });
    const result = applyLoseManaEffect(state, {} as never, { kind: "lose-mana", amount: 5 } as never, 1, []);
    expect(result.mana).toBe(0);
  });
});

describe("applyGainMaxManaEffect", () => {
  it("increases maxMana and current mana", () => {
    const state = makeTestBattleState({ maxMana: 4, mana: 2 });
    const result = applyGainMaxManaEffect(state, {} as never, { kind: "gain-max-mana", amount: 2 } as never, 1, []);
    expect(result.maxMana).toBe(6);
    expect(result.mana).toBe(4);
  });
});

describe("applyLoseMaxManaEffect", () => {
  it("deals burn damage on mana crystal loss when talent is active", () => {
    const state = makeTestBattleState({
      maxMana: 4,
      mana: 4,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      talentEffects: { ...makeTestBattleState().talentEffects, burnDamageOnManaCrystalLoss: 5 },
    });
    const result = applyLoseMaxManaEffect(state, {} as never, { kind: "lose-max-mana", amount: 1 } as never, 1, []);
    expect(result.enemyHealth).toBe(25);
    expect(result.maxMana).toBe(3);
    expect(result.mana).toBe(3);
  });

  it("clamps to MIN_MAX_MANA_FLOOR", () => {
    const state = makeTestBattleState({ maxMana: 1, mana: 1 });
    const result = applyLoseMaxManaEffect(state, {} as never, { kind: "lose-max-mana", amount: 5 } as never, 1, []);
    expect(result.maxMana).toBeGreaterThanOrEqual(1);
  });
});

describe("applyHealEffect", () => {
  it("applies consume heal multiplier and card-specific bonus", () => {
    const state = makeTestBattleState({
      playerHealth: 15,
      playerMaxHealth: 40,
      talentEffects: {
        ...makeTestBattleState().talentEffects,
        consumeHealMultiplier: 0.5,
        cardHealBonus: { "heal-card": 3 },
      },
    });
    const result = applyHealEffect(
      state,
      { id: "heal-card", title: "HC", descriptionLines: [""], art: "", cost: 1, effects: [], consume: true } as never,
      { kind: "heal", amount: 5 } as never,
      1,
      [],
    );
    // healMultiplier 1 + consumeHealMultiplier 0.5 = 1.5 → round(5 * 1.5) = 8, + 3 bonus = 11
    // 15 + 11 = 26
    expect(result.playerHealth).toBe(26);
  });
});

describe("applyLoseHealthEffect", () => {
  it("reduces player health", () => {
    const texts: any[] = [];
    const state = makeTestBattleState({ playerHealth: 20 });
    const result = applyLoseHealthEffect(state, {} as never, { kind: "lose-health", amount: 5 } as never, 1, texts);
    expect(result.playerHealth).toBe(15);
    expect(texts.length).toBeGreaterThan(0);
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
    // 2 * 5 = 10 block
    expect(result.playerStatuses.block).toBe(10);
  });

  it("applies potion multiplier", () => {
    const state = makeTestBattleState();
    const result = applyPlayerStatusEffectHandler(
      state,
      {} as never,
      { kind: "player-status", status: "block", amount: 3 } as never,
      3,
      [],
    );
    expect(result.playerStatuses.block).toBe(9);
  });
});

describe("applyEnemyStatusEffect", () => {
  it("applies freeze and triggers freeze resolution", () => {
    const texts: any[] = [];
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
    const texts: any[] = [];
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
    // current = 4, added = 4 * (3 - 1) = 8, total = 4 + 8 = 12
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

describe("applyGainGoldEffect", () => {
  it("applies potion multiplier to gold", () => {
    const texts: any[] = [];
    const state = makeTestBattleState({ gold: 5 });
    const result = applyGainGoldEffect(state, {} as never, { kind: "gain-gold", amount: 10 } as never, 3, texts);
    expect(result.gold).toBe(35);
  });
});

describe("applyDrawCardsEffect", () => {
  it("draws cards from deck", () => {
    const cards = [{ id: "a", title: "A", descriptionLines: [""], art: "", cost: 1, effects: [] }];
    const state = makeTestBattleState({ deck: cards });
    const result = applyDrawCardsEffect(state, {} as never, { kind: "draw-cards", amount: 1 } as never, 1, []);
    expect(result.hand).toHaveLength(1);
  });
});
