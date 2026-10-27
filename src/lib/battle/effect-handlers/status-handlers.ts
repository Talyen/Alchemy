import type { EffectHandlers } from "./handler-types";
import { applyPotionMultiplier } from "../amount-helpers";
import type { BattleState, CombatTextEvent } from "../types";
import { addEnemyStatus } from "../status-state";
import { mergeCombatText } from "../combat-text-events";
import { UTILITY_HANDLERS } from "./utility-handlers";
import { tryTriggerEnemyFreeze } from "../damage-status-riders";
import { resolveStunTrigger } from "../stun-leech-resolution";
import { dealDamageToEnemy } from "../damage";
import type { EnemyStatusId } from "@/lib/game-data";

function resolveEnemyStatusCcTrigger(
  preHitState: BattleState,
  nextState: BattleState,
  status: EnemyStatusId,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (status === "freeze") return tryTriggerEnemyFreeze(preHitState, nextState, combatTexts);
  if (status === "stun") return resolveStunTrigger(nextState, combatTexts);
  return nextState;
}

export const STATUS_HANDLERS = {
  "multiply-enemy-status": (state, _card, effect, _potionMult, combatTexts, context) => {
    const current = state.enemyStatuses[effect.status];
    if (current <= 0) return state;
    // Multiplication adds stacks subject to resistance, but is not another
    // attack eligible for the room's attack buildup bonus.
    const nextState = addEnemyStatus(state, effect.status, Math.round(current * (effect.factor - 1)), {
      attackBuildup: false,
      combatTexts,
    });
    mergeCombatText(combatTexts, {
      target: "enemy",
      kind: "multiply",
      stat: effect.status,
      amount: nextState.enemyStatuses[effect.status] - current,
      ...(context?.feedback ? { feedback: context.feedback } : {}),
    });

    return resolveEnemyStatusCcTrigger(state, nextState, effect.status, combatTexts);
  },
  "cleanse-player-status-to-damage": (state, card, effect, potionMult, combatTexts, context) => {
    const stacks = state.playerStatuses[effect.status];
    if (stacks <= 0) return state;

    const cleansed = UTILITY_HANDLERS["remove-player-status"](
      state,
      card,
      { kind: "remove-player-status", status: effect.status },
      1,
      combatTexts,
      context,
    );
    const amount = applyPotionMultiplier(stacks, potionMult);

    return dealDamageToEnemy(
      cleansed,
      card,
      { kind: "damage", damageType: effect.damageType, amount, ...(effect.lifesteal ? { lifesteal: true } : {}) },
      combatTexts,
      context,
    );
  },
} satisfies Partial<EffectHandlers>;
