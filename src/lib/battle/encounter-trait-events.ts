import type { BattleCard } from "@/lib/game-data";
import { halveRounded } from "./amount-helpers";
import { applyEnemyHealingWithCombatText, mergeCombatText } from "./combat-text";
import { applyEnemyLeechHealing, processEnemyDamageEffect } from "./enemy-attack-damage";
import { addEnemyMitigationWithCombatText } from "./encounter-trait-health-threshold";
import { isFreezeActiveForAspect, scaleByRoomMultiplier } from "./enemy-turn-traits";
import { getBattleRng, rollPercent } from "@/lib/rng";
import { hasEnemyTrait, setEnemyStatus, type BattleState, type CombatTextEvent } from "./types";

function addEnemyStatusText(
  state: BattleState,
  field: "forge" | "armor" | "block",
  amount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  return addEnemyMitigationWithCombatText(state, field, amount, combatTexts);
}

export function regrowEnemyThorns(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.enemyStatuses.thorns > 0) return state;
  const nextState = setEnemyStatus(state, "thorns", 1);
  mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "thorns", amount: 1 });
  return nextState;
}

export function processEncounterTraitActionStart(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  if (hasEnemyTrait(nextState, "tempered")) {
    nextState = addEnemyStatusText(nextState, "forge", scaleByRoomMultiplier(nextState, 1), combatTexts);
  }
  if (hasEnemyTrait(nextState, "plated")) {
    nextState = addEnemyStatusText(nextState, "armor", scaleByRoomMultiplier(nextState, 1), combatTexts);
  }
  if (hasEnemyTrait(nextState, "reinforced")) {
    nextState = addEnemyStatusText(nextState, "block", scaleByRoomMultiplier(nextState, 2), combatTexts);
  }
  if (hasEnemyTrait(nextState, "overgrowth")) {
    if (isFreezeActiveForAspect(nextState, "regen")) return nextState;
    let amount = scaleByRoomMultiplier(nextState, 1);
    if (nextState.enemyStatuses.poison > 0 && nextState.talentEffects.poisonHalvesHealing) {
      amount = halveRounded(amount);
    }
    if (nextState.enemyStatuses.bleed > 0 && nextState.talentEffects.bleedHalvesEnemyHealing) {
      amount = halveRounded(amount);
    }
    nextState = applyEnemyHealingWithCombatText(nextState, amount, combatTexts);
  }
  return nextState;
}

function dealTraitDamage(
  state: BattleState,
  damageType: "physical" | "holy" | "burn" | "poison" | "bleed" | "freeze" | "stun",
  baseAmount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  return processEnemyDamageEffect(
    state,
    { kind: "damage", damageType, amount: scaleByRoomMultiplier(state, baseAmount) },
    combatTexts,
  );
}

export function processEncounterTraitActionDamage(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  if (hasEnemyTrait(nextState, "septic")) {
    nextState = dealTraitDamage(
      nextState,
      rollPercent(50, getBattleRng(nextState)) ? "poison" : "bleed",
      1,
      combatTexts,
    );
  }
  if (hasEnemyTrait(nextState, "caustic")) {
    nextState = dealTraitDamage(nextState, "poison", 1, combatTexts);
    nextState = {
      ...nextState,
      playerStatuses: {
        ...nextState.playerStatuses,
        armor: Math.max(0, nextState.playerStatuses.armor - scaleByRoomMultiplier(nextState, 1)),
      },
    };
  }
  if (hasEnemyTrait(nextState, "flesheater")) {
    const beforeHealth = nextState.playerHealth;
    const beforeBleed = nextState.playerStatuses.bleed;
    nextState = dealTraitDamage(nextState, "bleed", 1, combatTexts);
    const damage = beforeHealth - nextState.playerHealth;
    if (damage > 0) {
      nextState = applyEnemyLeechHealing(nextState, damage, combatTexts);
      nextState = {
        ...nextState,
        pendingEnemyBleedLeechHealing:
          nextState.pendingEnemyBleedLeechHealing + Math.max(0, nextState.playerStatuses.bleed - beforeBleed),
      };
    }
  }
  if (hasEnemyTrait(nextState, "combustible")) nextState = dealTraitDamage(nextState, "burn", 1, combatTexts);
  if (hasEnemyTrait(nextState, "chilling")) nextState = dealTraitDamage(nextState, "freeze", 1, combatTexts);
  if (hasEnemyTrait(nextState, "zealot")) nextState = dealTraitDamage(nextState, "holy", 2, combatTexts);
  if (hasEnemyTrait(nextState, "concussive")) nextState = dealTraitDamage(nextState, "stun", 1, combatTexts);
  return nextState;
}

export function processEncounterTraitCardAction(
  state: BattleState,
  card: BattleCard,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = state;
  const scale = (amount: number) => scaleByRoomMultiplier(nextState, amount);
  if (card.consume && hasEnemyTrait(nextState, "insatiable")) {
    nextState = { ...nextState, enemyPhysicalDamageBonus: nextState.enemyPhysicalDamageBonus + scale(1) };
  }
  if (card.effects.some((effect) => effect.kind === "wish") && hasEnemyTrait(nextState, "jealous")) {
    nextState = { ...nextState, enemyPhysicalDamageBonus: nextState.enemyPhysicalDamageBonus + scale(1) };
  }
  if (
    card.effects.some((effect) => effect.kind === "damage" && effect.damageType === "nature") &&
    hasEnemyTrait(nextState, "rooted")
  ) {
    nextState = addEnemyStatusText(nextState, "block", scale(1), combatTexts);
  }
  if (card.effects.some((effect) => effect.kind === "damage")) {
    if (hasEnemyTrait(nextState, "thorns") && nextState.enemyStatuses.thorns > 0) {
      nextState = setEnemyStatus(nextState, "thorns", 0);
      nextState = dealTraitDamage(nextState, "physical", 1, combatTexts);
    }
    if (hasEnemyTrait(nextState, "holy-retribution")) nextState = dealTraitDamage(nextState, "holy", 1, combatTexts);
    if (hasEnemyTrait(nextState, "cinder-skin")) nextState = dealTraitDamage(nextState, "burn", 1, combatTexts);
  }
  return nextState;
}
