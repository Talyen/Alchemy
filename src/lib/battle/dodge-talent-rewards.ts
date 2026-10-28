import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { isPlayerDefeated } from "./battle-outcome";
import { rollBattleChance } from "./chance-roll";
import { REACTIVE_REWARD_CHANCES } from "../game-constants";
import { applyDrawResult, drawFromState } from "./draw";
import { addPlayerStatusWithCombatText } from "./player-rewards";
import { addForgeToPlayer, applyCleanseHeals } from "./status-player";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import type { BattleState, CombatTextEvent } from "./types";
import { setPlayerStatus } from "./status-state";
import { emitNoticeText, emitDamageText } from "./combat-text-events";

const CC_STATUSES = ["stun", "freeze"] as const;
const DAMAGE_OVER_TIME_STATUSES = ["burn", "poison", "bleed"] as const;

export function applyDodgeTalentStatuses(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  if (state.talentEffects.drawOnDodge > 0) {
    nextState = applyDrawResult(nextState, drawFromState(nextState, state.talentEffects.drawOnDodge), combatTexts);
  }
  if (state.talentEffects.forgeOnDodge > 0 && rollBattleChance(REACTIVE_REWARD_CHANCES.feint, nextState)) {
    nextState = addForgeToPlayer(nextState, state.talentEffects.forgeOnDodge, combatTexts);
  }
  if (state.talentEffects.thornsOnDodge > 0) {
    nextState = addPlayerStatusWithCombatText(nextState, "thorns", state.talentEffects.thornsOnDodge, combatTexts);
  }
  if (state.talentEffects.burnOnDodgeBurning > 0 && state.enemyStatuses.burn > 0) {
    nextState = resolveFollowUpHit(
      nextState,
      { source: "talent-fixed", damageType: "burn", amount: state.talentEffects.burnOnDodgeBurning },
      combatTexts,
    );
    nextState = resolvePendingBattleReactions(nextState, combatTexts);
    if (isPlayerDefeated(nextState)) return nextState;
  }
  if (
    state.talentEffects.cleanseCcOnDodge &&
    (nextState.playerStatuses.stun > 0 || nextState.playerStatuses.freeze > 0)
  ) {
    const removed = Number(nextState.playerStatuses.stun > 0) + Number(nextState.playerStatuses.freeze > 0);
    for (const status of CC_STATUSES) {
      if (nextState.playerStatuses[status] > 0) {
        emitNoticeText(combatTexts, "player", status, "", { signal: "cleanse" });
      }
    }
    nextState = applyCleanseHeals(
      { ...nextState, playerStatuses: { ...nextState.playerStatuses, stun: 0, freeze: 0 } },
      combatTexts,
      removed,
    );
  }
  const amount = state.talentEffects.cleanseStacksOnDodge;
  if (amount <= 0) return nextState;

  let removedStatuses = 0;
  for (const status of DAMAGE_OVER_TIME_STATUSES) {
    const previous = nextState.playerStatuses[status];
    nextState = setPlayerStatus(nextState, status, Math.max(0, previous - amount));
    if (previous > 0 && nextState.playerStatuses[status] === 0) {
      removedStatuses += 1;
      emitNoticeText(combatTexts, "player", status, "", { signal: "cleanse" });
    } else if (nextState.playerStatuses[status] < previous) {
      emitDamageText(combatTexts, "player", status, previous - nextState.playerStatuses[status], { impact: false });
    }
  }
  return removedStatuses > 0 ? applyCleanseHeals(nextState, combatTexts, 1) : nextState;
}
