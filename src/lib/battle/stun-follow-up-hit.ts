import { resolveSecondaryAction } from "./action-context";
import { applyHitEpilogue } from "./player-rewards";
import { mergeCombatText } from "./combat-text-events";
import { computeCardDamageToEnemy } from "./damage-calc";
import { applyHitHealth } from "./player-hit-core";
import { decayArmorAfterDamage } from "./status-helpers";
import { resolveStunTriggerCore, type ThunderstoneLeech } from "./status-stun-core";
import { addEnemyStatus, type BattleState, type CombatTextEvent } from "./types";

/** Leaf stun entry: stays free of hit-resolution tiers so leech riders can call it without a module cycle. */
export function resolveStunFollowUpHit(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
  leech: ThunderstoneLeech,
): BattleState {
  return resolveSecondaryAction(state, "reward", (current) => {
    if (amount <= 0 || current.enemyHealth <= 0) return current;
    const effect = { kind: "damage" as const, damageType: "stun" as const, amount };
    const { nextState: afterMods, modifiedDamage } = computeCardDamageToEnemy(current, effect);
    const hit = applyHitHealth(afterMods, modifiedDamage, current);
    const decayed = decayArmorAfterDamage(hit.state, modifiedDamage, "enemy", combatTexts);
    let nextState = resolveStunTriggerCore(
      addEnemyStatus(decayed, "stun", modifiedDamage),
      combatTexts,
      hit.facts.previousHealth,
      false,
      leech,
    );
    if (modifiedDamage > 0) {
      mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "stun", amount: modifiedDamage });
    }
    nextState = applyHitEpilogue(nextState, hit.facts.previousHealth, hit.facts.enemyWasAlive, combatTexts);
    return nextState;
  });
}
