import { resolveSecondaryAction } from "./action-context";
import { applyHitEpilogue, mergeCombatText } from "./combat-text";
import { computeCardDamageToEnemy } from "./damage-calc";
import { applyHitHealth } from "./hit-facts";
import { decayArmorAfterDamage } from "./status-helpers";
import { resolveStunTrigger } from "./status-stun-resolve";
import { addEnemyStatus, type BattleState, type CombatTextEvent } from "./types";

export function resolveStunFollowUpHit(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  return resolveSecondaryAction(state, "reward", (current) => {
    if (amount <= 0 || current.enemyHealth <= 0) return current;
    const effect = { kind: "damage" as const, damageType: "stun" as const, amount };
    const { nextState: afterMods, modifiedDamage } = computeCardDamageToEnemy(current, effect);
    const hit = applyHitHealth(afterMods, modifiedDamage, current);
    const decayed = decayArmorAfterDamage(hit.state, modifiedDamage, "enemy", combatTexts);
    let nextState = resolveStunTrigger(
      addEnemyStatus(decayed, "stun", modifiedDamage),
      combatTexts,
      hit.facts.previousHealth,
    );
    if (modifiedDamage > 0) {
      mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "stun", amount: modifiedDamage });
    }
    nextState = applyHitEpilogue(nextState, hit.facts.previousHealth, hit.facts.enemyWasAlive, combatTexts);
    return nextState;
  });
}
