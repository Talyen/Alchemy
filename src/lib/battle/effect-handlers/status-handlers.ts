import type { EffectHandlers } from "./handler-types";
import { applyPotionMultiplier } from "../amount-helpers";
import type { BattleState, CombatTextEvent } from "../types";
import { addEnemyStatus, setPlayerStatus } from "../status-state";
import { mergeCombatText } from "../combat-text-events";
import { applyPlayerStatusEffect, applyCleanseHeals, removeHarmfulPlayerStatuses } from "../status-player";
import { tryTriggerEnemyFreeze } from "../damage-status-riders";
import { resolveStunTrigger } from "../status-stun-resolve";
import { dealDamageToEnemy } from "../damage";
import type { EnemyStatusId, PlayerStatusId } from "@/lib/game-data";
import { resolveFollowUpHit } from "../follow-up-hit-resolution";
import { getBattleRng, pickRandom } from "@/lib/rng";

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

function cleansePlayerStatus(state: BattleState, status: PlayerStatusId, combatTexts: CombatTextEvent[]): BattleState {
  if (state.playerStatuses[status] <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "notice", stat: status, signal: "cleanse", text: "" });
  return applyCleanseHeals(setPlayerStatus(state, status, 0), combatTexts);
}

export const STATUS_HANDLERS = {
  "player-status": (state, _card, effect, potionMult, combatTexts, context) => {
    let adjustedAmount = effect.amount;
    let nextState = state;
    if (effect.convertCurrentMana !== undefined) {
      adjustedAmount = (context?.manaAtStart ?? state.mana) * effect.convertCurrentMana;
      if (state.mana > 0) {
        mergeCombatText(combatTexts, {
          target: "player",
          kind: "damage",
          stat: "mana",
          amount: state.mana,
          impact: false,
        });
      }
      nextState = { ...state, mana: 0 };
    } else if (effect.perManaCrystal !== undefined) {
      adjustedAmount = effect.perManaCrystal * state.maxMana;
    }
    adjustedAmount = applyPotionMultiplier(adjustedAmount, potionMult);
    const status = effect.statusPool
      ? (pickRandom(effect.statusPool, getBattleRng(nextState)) ?? effect.status)
      : effect.status;
    return applyPlayerStatusEffect(
      nextState,
      {
        ...effect,
        status,
        amount:
          status === "forge" && effect.forgeAmount !== undefined
            ? applyPotionMultiplier(effect.forgeAmount, potionMult)
            : adjustedAmount,
      },
      combatTexts,
    );
  },
  "enemy-status": (state, _card, effect, potionMult, combatTexts) => {
    const amount = applyPotionMultiplier(effect.amount, potionMult);
    if (effect.status === "stun" || effect.status === "freeze") {
      return resolveFollowUpHit(state, { source: "player-follow-up", damageType: effect.status, amount }, combatTexts);
    }
    const nextState = addEnemyStatus(state, effect.status, amount);
    const appliedAmount = nextState.enemyStatuses[effect.status] - state.enemyStatuses[effect.status];
    mergeCombatText(combatTexts, {
      target: "enemy",
      kind: effect.status === "burn" || effect.status === "poison" || effect.status === "bleed" ? "multiply" : "status",
      stat: effect.status,
      amount: appliedAmount,
    });

    return nextState;
  },
  "remove-harmful-status": (state, _card, effect, potionMult, combatTexts) => {
    const adjustedRemove = effect.removeAll
      ? Number.POSITIVE_INFINITY
      : applyPotionMultiplier(effect.amount ?? 0, potionMult);
    return removeHarmfulPlayerStatuses(state, adjustedRemove, combatTexts);
  },
  "remove-player-status": (state, _card, effect, _potionMult, combatTexts) => {
    return cleansePlayerStatus(state, effect.status, combatTexts);
  },
  "multiply-enemy-status": (state, _card, effect, _potionMult, combatTexts) => {
    const current = state.enemyStatuses[effect.status];
    if (current <= 0) return state;
    // Multiplication adds stacks subject to resistance, but is not another
    // attack eligible for the room's attack buildup bonus.
    const nextState = addEnemyStatus(state, effect.status, Math.round(current * (effect.factor - 1)), {
      attackBuildup: false,
    });
    mergeCombatText(combatTexts, {
      target: "enemy",
      kind: "multiply",
      stat: effect.status,
      amount: nextState.enemyStatuses[effect.status] - current,
    });

    return resolveEnemyStatusCcTrigger(state, nextState, effect.status, combatTexts);
  },
  "cleanse-player-status-to-damage": (state, card, effect, potionMult, combatTexts, context) => {
    const stacks = state.playerStatuses[effect.status];
    if (stacks <= 0) return state;

    const cleansed = cleansePlayerStatus(state, effect.status, combatTexts);
    const amount = applyPotionMultiplier(stacks, potionMult);

    return dealDamageToEnemy(
      cleansed,
      card,
      { kind: "damage", damageType: effect.damageType, amount },
      combatTexts,
      context,
    );
  },
} satisfies Partial<EffectHandlers>;
