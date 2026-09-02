import type { BattleCard, DamageType } from "@/lib/game-data";
import { computeCardDamageToEnemy } from "./damage-calc";
import { applyDamageStatuses } from "./damage-status-riders";
import { mergeCombatText, payKillPayouts } from "./combat-text";
import { decayArmorAfterDamage, rollTalentChance } from "./status-helpers";
import { damageEnemyHealth, type BattleState, type CombatTextEvent } from "./types";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-health-threshold";

const FOLLOW_UP_CARD: BattleCard = {
  id: "follow-up-typed-hit",
  title: "",
  descriptionLines: [],
  art: "",
  cost: 0,
  effects: [],
};

export function dealPlayerTypedHit(
  state: BattleState,
  damageType: DamageType,
  amount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (amount <= 0 || state.enemyHealth <= 0) return state;
  const effect = { kind: "damage" as const, damageType, amount };
  const { nextState: afterMods, modifiedDamage } = computeCardDamageToEnemy(state, effect, FOLLOW_UP_CARD);
  const hit = damageEnemyHealth(afterMods, modifiedDamage);
  const enemyWasAlive = hit.enemyWasAlive;
  const preHitHealth = hit.previousHealth;
  let nextState: BattleState = hit.state;
  nextState = decayArmorAfterDamage(nextState, modifiedDamage, "enemy", combatTexts);
  nextState = applyDamageStatuses(nextState, effect, modifiedDamage, combatTexts, preHitHealth);
  if (modifiedDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: damageType, amount: modifiedDamage });
  }
  nextState = processEncounterTraitHealthThreshold(preHitHealth, nextState, combatTexts);
  return payKillPayouts(nextState, enemyWasAlive, combatTexts);
}

export function tryPoisonStunProc(state: BattleState, damage: number, combatTexts: CombatTextEvent[]): BattleState {
  if (damage <= 0) return state;
  if (!rollTalentChance(state.talentEffects.poisonStunChance, state)) return state;
  return dealPlayerTypedHit(state, "stun", damage, combatTexts);
}
