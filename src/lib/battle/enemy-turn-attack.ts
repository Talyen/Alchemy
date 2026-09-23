import { resolveBattleSequence } from "./battle-sequence";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import {
  enemyAbilityDealsDamage,
  getEnemyAbilityCard,
  isEnemyAbilityCard,
  type BattleCard,
  type EnemyAbilityEffect,
} from "@/lib/game-data";
import { getBattleRng, pickRandom, rollChance } from "@/lib/rng";
import { halveRounded } from "./amount-helpers";
import { recordEnemyAbilityUse, recordEnemyAttackAction } from "./battle-metrics";
import { applyEnemyHealingWithCombatText, mergeCombatText } from "./combat-text";
import { createEnemyAbilityContext, type EnemyAbilityContext } from "./enemy-ability-context";
import { applyAbilityDamage } from "./enemy-ability-damage";
import { applyAbilityFollowups } from "./enemy-ability-followups";
import { addEnemyMitigationWithCombatText } from "./encounter-trait-health-threshold";
import { scaleByRoomMultiplier } from "./enemy-turn-traits";
import { removePlayerArmor } from "./status-helpers";
import { resolvePlayerCrowdControlTriggers } from "./status-cc";
import {
  addEnemyStatus,
  isPlayerDefeated,
  isStunFreezeBuildupBlocked,
  setFlag,
  setPlayerStatus,
  type BattleState,
  type CombatTextEvent,
} from "./types";

function applyEnemyEffect(
  state: BattleState,
  effect: EnemyAbilityEffect,
  context: EnemyAbilityContext,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (state.enemyHealth <= 0 || isPlayerDefeated(state)) return state;
  switch (effect.kind) {
    case "chance": {
      const effects = rollChance(effect.probability, getBattleRng(state))
        ? effect.successEffects
        : effect.failureEffects;
      return effects.reduce((next, nested) => applyEnemyEffect(next, nested, context, combatTexts), state);
    }
    case "damage":
      return applyAbilityDamage(state, effect, context, combatTexts);
    case "heal":
      return applyEnemyHealingWithCombatText(state, scaleByRoomMultiplier(state, effect.amount), combatTexts);
    case "player-status": {
      const amount = scaleByRoomMultiplier(state, effect.amount);
      if (effect.status !== "thorns")
        return addEnemyMitigationWithCombatText(state, effect.status, amount, combatTexts);
      mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "thorns", amount });
      return addEnemyStatus(state, "thorns", amount);
    }
    case "remove-enemy-armor": {
      const remainingArmor = effect.halve ? halveRounded(state.playerStatuses.armor) : 0;
      const amount = effect.halve
        ? state.playerStatuses.armor - remainingArmor
        : effect.removeAll
          ? state.playerStatuses.armor
          : Math.min(state.playerStatuses.armor, scaleByRoomMultiplier(state, effect.amount ?? 0));
      if (amount <= 0) return state;
      mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "armor", amount });
      return removePlayerArmor(state, amount, combatTexts);
    }
    case "multiply-enemy-status": {
      if (isStunFreezeBuildupBlocked(state.playerCC)) return state;
      const amount = Math.round(state.playerStatuses.freeze * effect.factor);
      const nextState = setPlayerStatus(state, "freeze", amount);
      const added = amount - state.playerStatuses.freeze;
      if (added > 0)
        mergeCombatText(combatTexts, { target: "player", kind: "multiply", stat: "freeze", amount: added });
      return resolvePlayerCrowdControlTriggers(nextState, combatTexts);
    }
  }
}

export function applyEnemyAbility(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]): BattleState {
  if (!isEnemyAbilityCard(card)) throw new Error(`Unsupported enemy ability: ${card.id}`);
  if (state.enemyHealth <= 0 || isPlayerDefeated(state)) return state;
  const damaging = enemyAbilityDealsDamage(card);
  const context = createEnemyAbilityContext(state, damaging);
  let nextState = recordEnemyAbilityUse({ ...state, lastEnemyAbilityId: card.id }, card.id);
  if (damaging) nextState = recordEnemyAttackAction(nextState);
  if (context.brawlerPenalty) nextState = setFlag(nextState, "enemyBrawlerDamagePenalty", false);
  nextState = resolveBattleSequence(
    nextState,
    card.effects,
    combatTexts,
    (next, effect) => applyEnemyEffect(next, effect, context, combatTexts),
    { kind: "each-step", settle: resolvePendingBattleReactions },
    "either-defeated",
  );
  if (!damaging || nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) return nextState;
  return resolvePendingBattleReactions(applyAbilityFollowups(nextState, context, combatTexts), combatTexts);
}

export function processEnemyAbility(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.enemyHealth <= 0 || isPlayerDefeated(state)) return state;
  const candidates = state.currentEnemy.abilityIds.filter((id) => id !== state.lastEnemyAbilityId);
  if (candidates.length === 0) throw new Error(`Enemy has no available ability: ${state.currentEnemy.id}`);
  const id = pickRandom(candidates, getBattleRng(state));
  if (!id) throw new Error(`Enemy has no available ability: ${state.currentEnemy.id}`);
  return applyEnemyAbility(state, getEnemyAbilityCard(id), combatTexts);
}
