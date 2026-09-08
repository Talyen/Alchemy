import { recordEnemyAbilityActivation } from "./battle-metrics";
import type { BattleCard } from "@/lib/game-data";
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
    nextState = recordEnemyAbilityActivation(nextState, "tempered");
    nextState = addEnemyStatusText(nextState, "forge", scaleByRoomMultiplier(nextState, 1), combatTexts);
  }
  if (hasEnemyTrait(nextState, "plated")) {
    nextState = recordEnemyAbilityActivation(nextState, "plated");
    nextState = addEnemyStatusText(nextState, "armor", scaleByRoomMultiplier(nextState, 1), combatTexts);
  }
  if (hasEnemyTrait(nextState, "reinforced")) {
    nextState = recordEnemyAbilityActivation(nextState, "reinforced");
    nextState = addEnemyStatusText(nextState, "block", scaleByRoomMultiplier(nextState, 2), combatTexts);
  }
  if (hasEnemyTrait(nextState, "overgrowth")) {
    if (isFreezeActiveForAspect(nextState, "regen")) return nextState;
    nextState = recordEnemyAbilityActivation(nextState, "overgrowth");
    nextState = applyEnemyHealingWithCombatText(nextState, scaleByRoomMultiplier(nextState, 1), combatTexts);
  }
  return nextState;
}

function dealTraitDamage(
  state: BattleState,
  damageType: "physical" | "holy" | "burn" | "poison" | "bleed" | "freeze" | "stun" | "nature",
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
    nextState = recordEnemyAbilityActivation(nextState, "septic");
    nextState = dealTraitDamage(
      nextState,
      rollPercent(50, getBattleRng(nextState)) ? "poison" : "bleed",
      1,
      combatTexts,
    );
  }
  if (hasEnemyTrait(nextState, "caustic")) {
    nextState = recordEnemyAbilityActivation(nextState, "caustic");
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
    nextState = recordEnemyAbilityActivation(nextState, "flesheater");
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
  if (hasEnemyTrait(nextState, "toxic"))
    nextState = dealTraitDamage(recordEnemyAbilityActivation(nextState, "toxic"), "poison", 1, combatTexts);
  if (hasEnemyTrait(nextState, "bloodletter"))
    nextState = dealTraitDamage(recordEnemyAbilityActivation(nextState, "bloodletter"), "bleed", 1, combatTexts);
  if (hasEnemyTrait(nextState, "combustible"))
    nextState = dealTraitDamage(recordEnemyAbilityActivation(nextState, "combustible"), "burn", 1, combatTexts);
  if (hasEnemyTrait(nextState, "chilling"))
    nextState = dealTraitDamage(recordEnemyAbilityActivation(nextState, "chilling"), "freeze", 1, combatTexts);
  if (hasEnemyTrait(nextState, "zealot"))
    nextState = dealTraitDamage(recordEnemyAbilityActivation(nextState, "zealot"), "holy", 2, combatTexts);
  if (hasEnemyTrait(nextState, "concussive"))
    nextState = dealTraitDamage(recordEnemyAbilityActivation(nextState, "concussive"), "stun", 1, combatTexts);
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
    nextState = recordEnemyAbilityActivation(nextState, "insatiable");
    nextState = { ...nextState, enemyPhysicalDamageBonus: nextState.enemyPhysicalDamageBonus + scale(1) };
  }
  if (card.effects.some((effect) => effect.kind === "wish") && hasEnemyTrait(nextState, "jealous")) {
    nextState = recordEnemyAbilityActivation(nextState, "jealous");
    nextState = { ...nextState, enemyPhysicalDamageBonus: nextState.enemyPhysicalDamageBonus + scale(1) };
  }
  if (
    card.effects.some((effect) => effect.kind === "damage" && effect.damageType === "nature") &&
    hasEnemyTrait(nextState, "rooted")
  ) {
    nextState = recordEnemyAbilityActivation(nextState, "rooted");
    nextState = addEnemyStatusText(nextState, "block", scale(1), combatTexts);
  }
  if (card.effects.some((effect) => effect.kind === "damage" || effect.kind === "random-damage")) {
    if (hasEnemyTrait(nextState, "thorns") && nextState.enemyStatuses.thorns > 0) {
      nextState = recordEnemyAbilityActivation(nextState, "thorns");
      nextState = setEnemyStatus(nextState, "thorns", 0);
      nextState = dealTraitDamage(nextState, "physical", 1, combatTexts);
    }
    if (hasEnemyTrait(nextState, "holy-retribution"))
      nextState = dealTraitDamage(recordEnemyAbilityActivation(nextState, "holy-retribution"), "holy", 1, combatTexts);
    if (hasEnemyTrait(nextState, "cinder-skin"))
      nextState = dealTraitDamage(recordEnemyAbilityActivation(nextState, "cinder-skin"), "burn", 1, combatTexts);
  }
  return nextState;
}

export function applyEncounterThorns(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.enemyHealth <= 0 || state.enemyStatuses.thorns <= 0) return state;
  const id = hasEnemyTrait(state, "briar-crown")
    ? "briar-crown"
    : hasEnemyTrait(state, "thornhide")
      ? "thornhide"
      : null;
  if (!id) return state;
  const amount = state.enemyStatuses.thorns;
  return processEnemyDamageEffect(
    setEnemyStatus(recordEnemyAbilityActivation(state, id), "thorns", 0),
    { kind: "damage", damageType: "nature", amount },
    combatTexts,
  );
}
