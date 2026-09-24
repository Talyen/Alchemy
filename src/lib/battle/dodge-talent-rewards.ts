import { REACTIVE_REWARD_CHANCES } from "../game-constants";
import { rollTalentChance } from "./status-helpers";
import { applyDrawResult, drawFromState } from "./draw";
import { addPlayerStatusWithCombatText } from "./combat-text";
import { addForgeToPlayer, applyCleanseHeals } from "./status-player";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { setPlayerStatus, type BattleState, type CombatTextEvent } from "./types";

export function applyDodgeTalentStatuses(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  if (state.talentEffects.drawOnDodge > 0) {
    nextState = applyDrawResult(nextState, drawFromState(nextState, state.talentEffects.drawOnDodge));
  }
  if (state.talentEffects.forgeOnDodge > 0 && rollTalentChance(REACTIVE_REWARD_CHANCES.feint, nextState)) {
    nextState = addForgeToPlayer(nextState, state.talentEffects.forgeOnDodge, combatTexts);
  }
  if (state.talentEffects.thornsOnDodge > 0) {
    nextState = addPlayerStatusWithCombatText(nextState, "thorns", state.talentEffects.thornsOnDodge, combatTexts);
  }
  if (state.enemyStatuses.burn > 0) {
    nextState = resolveFollowUpHit(
      nextState,
      { source: "talent-fixed", damageType: "burn", amount: state.talentEffects.burnOnDodgeBurning },
      combatTexts,
    );
  }
  if (
    state.talentEffects.cleanseCcOnDodge &&
    (nextState.playerStatuses.stun > 0 || nextState.playerStatuses.freeze > 0)
  ) {
    const removed = Number(nextState.playerStatuses.stun > 0) + Number(nextState.playerStatuses.freeze > 0);
    nextState = applyCleanseHeals(
      { ...nextState, playerStatuses: { ...nextState.playerStatuses, stun: 0, freeze: 0 } },
      combatTexts,
      removed,
    );
  }
  const amount = state.talentEffects.cleanseStacksOnDodge;
  if (amount <= 0) return nextState;

  let removedStatuses = 0;
  for (const status of ["burn", "poison", "bleed"] as const) {
    const previous = nextState.playerStatuses[status];
    nextState = setPlayerStatus(nextState, status, Math.max(0, previous - amount));
    removedStatuses += Number(previous > 0 && nextState.playerStatuses[status] === 0);
  }
  return removedStatuses > 0 ? applyCleanseHeals(nextState, combatTexts, removedStatuses) : nextState;
}
