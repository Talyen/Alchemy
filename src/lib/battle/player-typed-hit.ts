/**
 * Player-side Stun/Freeze (and other typed) follow-up hits. Stacks come from the
 * damage pipeline, not from addEnemyStatus. Avoids applyDamageRiders so riders
 * can call this without a cycle.
 */
import type { BattleCard, DamageType } from "@/lib/game-data";
import { computeCardDamageToEnemy } from "./damage-calc";
import { applyDamageStatuses } from "./damage-status-riders";
import { payKillPayouts } from "./kill-payouts";
import { mergeCombatText } from "./combat-text";
import { decayArmorAfterDamage } from "./status-helpers";
import { clampHealth, type BattleState, type CombatTextEvent } from "./types";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-events";

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
  const enemyWasAlive = afterMods.enemyHealth > 0;
  const preHitHealth = afterMods.enemyHealth;
  let nextState: BattleState = {
    ...afterMods,
    enemyHealth: clampHealth(afterMods.enemyHealth, -modifiedDamage, afterMods.enemyMaxHealth),
  };
  nextState = decayArmorAfterDamage(nextState, modifiedDamage, "enemy", combatTexts);
  nextState = applyDamageStatuses(nextState, effect, modifiedDamage, combatTexts, preHitHealth);
  if (modifiedDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: damageType, amount: modifiedDamage });
  }
  nextState = processEncounterTraitHealthThreshold(preHitHealth, nextState, combatTexts);
  return payKillPayouts(nextState, enemyWasAlive, combatTexts);
}
