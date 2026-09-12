import { applyDrawResult, drawFromState } from "./draw";
import { addPlayerStatusWithCombatText } from "./combat-text";
import { addForgeToPlayer, applyCleanseHeals } from "./status-player";
import { dealTalentTypedHit } from "./player-typed-hit";
import { setPlayerStatus, type BattleState, type CombatTextEvent } from "./types";

export function applyDodgeTalentStatuses(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  if (state.talentEffects.drawOnDodge > 0) {
    nextState = applyDrawResult(nextState, drawFromState(nextState, state.talentEffects.drawOnDodge));
  }
  if (state.talentEffects.forgeOnDodge > 0) {
    nextState = addForgeToPlayer(nextState, state.talentEffects.forgeOnDodge, combatTexts);
  }
  if (state.talentEffects.thornsOnDodge > 0) {
    nextState = addPlayerStatusWithCombatText(nextState, "thorns", state.talentEffects.thornsOnDodge, combatTexts);
  }
  if (state.enemyStatuses.burn > 0) {
    nextState = dealTalentTypedHit(nextState, "burn", state.talentEffects.burnOnDodgeBurning, combatTexts);
  }
  if (
    state.talentEffects.cleanseCcOnDodge &&
    (nextState.playerStatuses.stun > 0 || nextState.playerStatuses.freeze > 0)
  ) {
    nextState = applyCleanseHeals(
      { ...nextState, playerStatuses: { ...nextState.playerStatuses, stun: 0, freeze: 0 } },
      combatTexts,
    );
  }
  const amount = state.talentEffects.cleanseStacksOnDodge;
  if (amount <= 0) return nextState;

  let removedStatus = false;
  for (const status of ["burn", "poison", "bleed"] as const) {
    const previous = nextState.playerStatuses[status];
    nextState = setPlayerStatus(nextState, status, Math.max(0, previous - amount));
    removedStatus ||= previous > 0 && nextState.playerStatuses[status] === 0;
  }
  return removedStatus ? applyCleanseHeals(nextState, combatTexts) : nextState;
}
