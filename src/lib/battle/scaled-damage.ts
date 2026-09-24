import { applyHitEpilogue } from "./player-rewards";
import { mergeCombatText } from "./combat-text-events";
import { addEnemyStatus, damageEnemyHealth, type BattleState, type CombatTextEvent } from "./types";
import { decayArmorAfterDamage } from "./status-helpers";
import { paceCombatDamage } from "./fight-pacing";
import { applyElementalDamageManaRestore } from "./elemental-mana";

export interface DealEnemyScaledDamageOptions {
  multiplier?: number;
  riders?: (state: BattleState, finalDamage: number, combatTexts: CombatTextEvent[]) => BattleState;
}

export function dealEnemyScaledDamage(
  state: BattleState,
  baseDamage: number,
  stat: "physical" | "burn" | "nature",
  combatTexts: CombatTextEvent[],
  options: DealEnemyScaledDamageOptions = {},
): BattleState {
  if (baseDamage <= 0 || state.enemyHealth <= 0) return state;
  const pacedDamage = paceCombatDamage(state, baseDamage, "player");
  const finalDamage = Math.round(pacedDamage * (options.multiplier ?? 1));
  if (finalDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat, amount: finalDamage });
  }
  const hit = damageEnemyHealth(state, finalDamage);
  const resolved = options.riders ? options.riders(hit.state, finalDamage, combatTexts) : hit.state;
  return applyElementalDamageManaRestore(resolved, stat, hit.healthDamage, combatTexts);
}

// Shared closer for scaled burn hits that also stack burn: forge bursts,
// consume burn, and mana-crystal-loss burn previously each re-assembled this
// riders chain with only the damage source varying.
export function dealScaledBurnWithStacks(
  state: BattleState,
  baseDamage: number,
  combatTexts: CombatTextEvent[],
  options: { multiplier?: number } = {},
): BattleState {
  if (baseDamage <= 0 || state.enemyHealth <= 0) return state;
  const preHitHealth = state.enemyHealth;
  return dealEnemyScaledDamage(state, baseDamage, "burn", combatTexts, {
    ...options,
    riders: (damaged, finalDamage, texts) => {
      const burning = addEnemyStatus(damaged, "burn", finalDamage);
      const decayed = decayArmorAfterDamage(burning, finalDamage, "enemy", texts);
      return applyHitEpilogue(decayed, preHitHealth, preHitHealth > 0, texts);
    },
  });
}
