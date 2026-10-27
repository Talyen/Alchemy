import { describe, expect, it } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { inspectedAttackAmounts } from "../../fixtures/inspection";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import { projectEnemyDotDamage } from "@/lib/battle/dot-resolve";
import { getBattleCompanionDamageModifiers } from "@/lib/battle/companion-scaling";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { applyBlockReward, applyHealingWithCombatText } from "@/lib/battle/player-rewards";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { tickPlayerStatuses } from "@/lib/battle/status-ticks";
import { dealSelfDamage } from "@/lib/battle/status-helpers";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { effectsForAffixRolls } from "@/lib/gear";
import { companionLibrary, enemyById, type DamageType, type BattleCard } from "@/lib/game-data";
import type { CombatTextEvent } from "@/lib/battle/types";
import { makeTestCard, patchBattleState, type BattleStatePatch } from "../../fixtures/battle";

function battle(patch: BattleStatePatch = {}) {
  return patchBattleState({
    enemyHealth: 100,
    enemyMaxHealth: 100,
    playerHealth: 40,
    playerMaxHealth: 40,
    currentEnemy: { ...enemyById.goblin, traits: [] },
    rng: () => 0.99,
    ...patch,
  });
}
function attack(damageType: DamageType = "physical", tags?: BattleCard["tags"]) {
  return makeTestCard({ cost: 0, tags, effects: [{ kind: "damage", damageType, amount: 3 }] });
}
function play(state: ReturnType<typeof battle>, card: BattleCard) {
  return playBattleCardResolved({ ...state, hand: [card] }, card.id, 0);
}
function textKinds(texts: CombatTextEvent[]) {
  return texts.map(({ target, kind, stat }) => ({ target, kind, stat }));
}

describe("affixes that modify existing combat events", () => {
  it("checks Firstblood on each hit and keeps inspection and floating text aligned with live damage", () => {
    const hit = attack().effects[0]!;
    const double = makeTestCard({ cost: 0, effects: [hit, hit] });
    const state = battle({ gearEffects: { attackBonusVsFullHealth: 5 } });
    const result = play(state, double);
    expect(result.state.enemyHealth).toBe(89);
    expect(inspectedAttackAmounts(double, state)).toEqual([8, 3]);
    expect(textKinds(result.combatTexts)).toEqual(textKinds(play(battle(), double).combatTexts));
    const wounded = { ...state, enemyHealth: 99 };
    expect(play(wounded, attack()).state.enemyHealth).toBe(96);
    expect(computeCardDamageToEnemy(state, { kind: "damage", damageType: "physical", amount: 3 }).modifiedDamage).toBe(
      3,
    );
  });

  it.each([
    {
      damageType: "physical",
      tags: ["archery"],
      patch: { enemyStatuses: { poison: 2 } },
      gearEffects: { archeryAttackBonusVsPoisoned: 5 },
    },
    {
      damageType: "holy",
      tags: [],
      patch: { enemyStatuses: { burn: 2 } },
      gearEffects: { holyAttackBonusVsBurning: 3 },
    },
    {
      damageType: "freeze",
      tags: [],
      patch: { playerStatuses: { block: 1 } },
      gearEffects: { freezeAttackBonusWithBlock: 3 },
    },
  ] as const)(
    "adds the $damageType conditional bonus to its existing attack only",
    ({ damageType, tags, patch, gearEffects }) => {
      const card = attack(damageType, [...tags]);
      const effect = { kind: "damage", damageType, amount: 3 } as const;
      const state = battle({ ...patch, gearEffects });
      const base = play(battle(patch), card);
      const result = play(state, card);
      expect(textKinds(result.combatTexts)).toEqual(textKinds(base.combatTexts));
      const bonus = Object.values(gearEffects)[0]!;
      expect(computeCardDamageToEnemy(state, effect, card).modifiedDamage).toBe(3 + bonus);
      expect(computeCardDamageToEnemy(battle({ gearEffects }), effect, card).modifiedDamage).toBe(3);
      expect(computeCardDamageToEnemy(state, effect).modifiedDamage).toBe(3);
      expect(
        computeCardDamageToEnemy(state, effect, card, { manaAtStart: 4, origin: "companion" }).modifiedDamage,
      ).toBe(3);
      if (damageType === "physical") expect(play(state, attack()).state.enemyHealth).toBe(97);
      if (damageType === "freeze") expect(result.state.enemyStatuses.freeze).toBe(6);
    },
  );

  it("applies Bloodscent to real Companion hits without applying hero attack bonuses or creating extra text", () => {
    const state = battle({
      activeCompanion: companionLibrary.phoenix,
      enemyStatuses: { bleed: 4 },
      gearEffects: { companionDamageBonusVsBleeding: 3, attackBonusVsFullHealth: 5, holyAttackBonusVsBurning: 3 },
    });
    const texts: CombatTextEvent[] = [];
    const baseTexts: CombatTextEvent[] = [];
    const base = processCompanionTurnStart({ ...state, gearEffects: battle().gearEffects }, baseTexts);
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyHealth).toBe(base.enemyHealth - 3);
    const lowHealth = {
      ...state,
      enemyHealth: 20,
      talentEffects: { ...state.talentEffects, companionDoubledVsLowHealth: true },
    };
    expect(getBattleCompanionDamageModifiers(lowHealth)).toEqual({ damageBonus: 3, damageMultiplier: 2 });
    expect(processCompanionTurnStart(lowHealth, []).enemyHealth).toBe(12);
    expect(textKinds(texts)).toEqual(textKinds(baseTexts));
    expect(play(state, attack("burn")).state.enemyHealth).toBe(92);
    expect(
      processCompanionTurnStart({ ...state, enemyStatuses: { ...state.enemyStatuses, bleed: 0 } }, []).enemyHealth,
    ).toBe(base.enemyHealth);
    for (const status of ["burn", "poison", "bleed"] as const) {
      const ticking = { ...state, enemyStatuses: { ...state.enemyStatuses, [status]: 4 } };
      expect(projectEnemyDotDamage(ticking, status)).toBe(
        projectEnemyDotDamage({ ...ticking, gearEffects: battle().gearEffects }, status),
      );
    }
  });

  it("adds Last Bastion to positive Block gains below half Health, alongside Warding and Forge in one event", () => {
    const state = battle({
      playerHealth: 19,
      playerStatuses: { forge: 2 },
      talentEffects: { forgeBlockPercent: 100 },
      gearEffects: { blockGainBonusBelowHalfHealth: 4, flatBlockGained: 1 },
    });
    const texts: CombatTextEvent[] = [];
    expect(applyBlockReward(state, 2, texts).playerStatuses.block).toBe(9);
    expect(texts).toEqual([expect.objectContaining({ kind: "status", stat: "block", amount: 9 })]);
    expect(applyBlockReward({ ...state, playerHealth: 20 }, 2, []).playerStatuses.block).toBe(5);
    expect(
      applyBlockReward({ ...state, playerStatuses: { ...state.playerStatuses, forge: 0 } }, 0, []).playerStatuses.block,
    ).toBe(0);
  });

  it("applies Mending before healing multipliers, rechecks half Health per heal, and never creates a heal", () => {
    const state = battle({
      playerHealth: 19,
      talentEffects: { healMultiplier: 2 },
      gearEffects: { healingBonusBelowHalfHealth: 3 },
    });
    const texts: CombatTextEvent[] = [];
    const healed = applyHealingWithCombatText(state, 1, texts);
    expect(healed.playerHealth).toBe(27);
    expect(texts).toEqual([expect.objectContaining({ kind: "heal", stat: "health", amount: 8 })]);
    expect(applyHealingWithCombatText(healed, 1, []).playerHealth).toBe(29);
    expect(applyHealingWithCombatText({ ...state, playerHealth: 20 }, 1, []).playerHealth).toBe(22);
    expect(applyHealingWithCombatText(state, 0, [])).toBe(state);
    expect(applyHealingWithCombatText({ ...state, playerHealth: 0, deathsDoorUsed: true }, 1, []).playerHealth).toBe(0);
    const card = makeTestCard({ cost: 0, effects: [{ kind: "heal", amount: 1 }] });
    expect(play(state, card).state.playerHealth).toBe(27);
  });

  it("applies Spentward before Block only without Mana, preserves contact and Dodge, and excludes DoT and self costs", () => {
    const state = battle({
      mana: 0,
      playerStatuses: { block: 4 },
      gearEffects: { enemyAttackReductionWithoutMana: 2 },
    });
    const hit = { kind: "damage", damageType: "physical", amount: 5 } as const;
    const texts: CombatTextEvent[] = [];
    const result = resolveEnemyAttackHit(state, hit, texts, { canDodge: true });
    expect(result.state.playerHealth).toBe(40);
    expect(result.state.playerStatuses.block).toBe(1);
    expect(texts).toEqual([expect.objectContaining({ kind: "damage", stat: "block", amount: 3 })]);
    expect(resolveEnemyAttackHit({ ...state, mana: 1 }, hit, [], { canDodge: true }).state.playerHealth).toBe(39);
    const prevented = resolveEnemyAttackHit(
      { ...state, playerStatuses: { ...state.playerStatuses, block: 0 } },
      { ...hit, amount: 1 },
      [],
      { canDodge: false },
    );
    expect(prevented).toMatchObject({ landed: true, attemptedDamage: 1, resolvedDamage: 0 });
    const dodged = resolveEnemyAttackHit({ ...state, flags: { ...state.flags, dodgeNextAttack: true } }, hit, [], {
      canDodge: true,
    });
    expect(dodged.dodged).toBe(true);
    expect(processEnemyDamageEffect(state, hit, [], { ignorePlayerMitigation: true }).playerHealth).toBe(35);
    expect(dealSelfDamage(state, 3, "health", []).state.playerHealth).toBe(37);
    const poisoned = { ...state, playerStatuses: { ...state.playerStatuses, block: 0, poison: 3 } };
    expect(tickPlayerStatuses(poisoned, []).playerHealth).toBe(37);
  });

  it("sums equipped copies and safely defaults additive saved magnitudes", () => {
    const gearEffects = effectsForAffixRolls([
      { id: "attack-vs-full-health", value: 5 },
      { id: "attack-vs-full-health", value: 4 },
      { id: "healing-below-half-health", value: 3 },
    ]);
    const saved = JSON.parse(JSON.stringify(battle({ gearEffects })));
    expect(PersistedBattleStateSchema.parse(saved).gearEffects.attackBonusVsFullHealth).toBe(9);
    delete saved.gearEffects.healingBonusBelowHalfHealth;
    expect(PersistedBattleStateSchema.parse(saved).gearEffects.healingBonusBelowHalfHealth).toBe(0);
  });
});
