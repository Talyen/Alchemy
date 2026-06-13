// Shared encounter trait event dispatch for enemy actions, card actions, and health thresholds.
import type { BattleCard } from "@/lib/game-data";
import { HALF_DIVISOR } from "../game-constants";
import { mergeCombatText } from "./combat-text";
import { applyEnemyLeechHealing, processEnemyDamageEffect } from "./enemy-turn-attack";
import { isFreezeActiveForAspect, scaleByRoomMultiplier } from "./enemy-turn-utils";
import { addEnemyMitigation, clampHealth, type BattleState, type CombatTextEvent } from "./types";

function hasTrait(state: BattleState, id: string): boolean {
  return state.currentEnemy.traits.some((trait) => trait.id === id);
}

function addEnemyStatusText(
  state: BattleState,
  field: "forge" | "armor" | "block",
  amount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: field, amount });
  return addEnemyMitigation(state, field, amount);
}

export function processEncounterTraitActionStart(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  if (hasTrait(nextState, "tempered")) {
    nextState = addEnemyStatusText(nextState, "forge", scaleByRoomMultiplier(nextState, 1), combatTexts);
  }
  if (hasTrait(nextState, "plated")) {
    nextState = addEnemyStatusText(nextState, "armor", scaleByRoomMultiplier(nextState, 1), combatTexts);
  }
  if (hasTrait(nextState, "reinforced")) {
    nextState = addEnemyStatusText(nextState, "block", scaleByRoomMultiplier(nextState, 2), combatTexts);
  }
  if (hasTrait(nextState, "overgrowth")) {
    if (isFreezeActiveForAspect(nextState, "regen")) return nextState;
    let amount = scaleByRoomMultiplier(nextState, 1);
    if (nextState.enemyStatuses.poison > 0 && nextState.talentEffects.poisonHalvesHealing) {
      amount = Math.round(amount / HALF_DIVISOR);
    }
    if (nextState.enemyStatuses.bleed > 0 && nextState.talentEffects.bleedHalvesEnemyHealing) {
      amount = Math.round(amount / HALF_DIVISOR);
    }
    const before = nextState.enemyHealth;
    nextState = { ...nextState, enemyHealth: clampHealth(nextState.enemyHealth, amount, nextState.enemyMaxHealth) };
    const healed = nextState.enemyHealth - before;
    if (healed > 0) mergeCombatText(combatTexts, { target: "enemy", kind: "heal", stat: "health", amount: healed });
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
  if (hasTrait(nextState, "septic")) {
    nextState = dealTraitDamage(nextState, nextState.rng() < 0.5 ? "poison" : "bleed", 1, combatTexts);
  }
  if (hasTrait(nextState, "caustic")) {
    nextState = dealTraitDamage(nextState, "poison", 1, combatTexts);
    nextState = {
      ...nextState,
      playerStatuses: {
        ...nextState.playerStatuses,
        armor: Math.max(0, nextState.playerStatuses.armor - scaleByRoomMultiplier(nextState, 1)),
      },
    };
  }
  if (hasTrait(nextState, "flesheater")) {
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
  if (hasTrait(nextState, "combustible")) nextState = dealTraitDamage(nextState, "burn", 1, combatTexts);
  if (hasTrait(nextState, "chilling")) nextState = dealTraitDamage(nextState, "freeze", 1, combatTexts);
  if (hasTrait(nextState, "zealot")) nextState = dealTraitDamage(nextState, "holy", 2, combatTexts);
  if (hasTrait(nextState, "concussive")) nextState = dealTraitDamage(nextState, "stun", 1, combatTexts);
  return nextState;
}

export function processEncounterTraitCardAction(
  state: BattleState,
  card: BattleCard,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = state;
  const scale = (amount: number) => scaleByRoomMultiplier(nextState, amount);
  if (card.consume && hasTrait(nextState, "insatiable")) {
    nextState = { ...nextState, enemyPhysicalDamageBonus: nextState.enemyPhysicalDamageBonus + scale(1) };
  }
  if (card.effects.some((effect) => effect.kind === "wish") && hasTrait(nextState, "jealous")) {
    nextState = { ...nextState, enemyPhysicalDamageBonus: nextState.enemyPhysicalDamageBonus + scale(1) };
  }
  if (
    card.effects.some((effect) => effect.kind === "damage" && effect.damageType === "nature") &&
    hasTrait(nextState, "rooted")
  ) {
    nextState = addEnemyStatusText(nextState, "block", scale(1), combatTexts);
  }
  if (card.effects.some((effect) => effect.kind === "damage")) {
    if (hasTrait(nextState, "thorns")) nextState = dealTraitDamage(nextState, "physical", 1, combatTexts);
    if (hasTrait(nextState, "holy-retribution")) nextState = dealTraitDamage(nextState, "holy", 1, combatTexts);
  }
  return nextState;
}

export function processEncounterTraitHealthThreshold(
  previousHealth: number,
  state: BattleState,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (
    !hasTrait(state, "divine-aegis") ||
    state.flags.divineAegisTriggered ||
    previousHealth <= state.enemyMaxHealth / 2 ||
    state.enemyHealth > state.enemyMaxHealth / 2
  )
    return state;
  let nextState = { ...state, flags: { ...state.flags, divineAegisTriggered: true } };
  nextState = addEnemyStatusText(nextState, "armor", scaleByRoomMultiplier(nextState, 2), combatTexts);
  return addEnemyStatusText(nextState, "block", scaleByRoomMultiplier(nextState, 4), combatTexts);
}
