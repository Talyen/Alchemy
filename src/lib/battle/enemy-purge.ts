import { beneficialEnemyStatusIds } from "@/lib/game-data";
import { applyBlockReward } from "./status-player";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import type { BattleState, CombatTextEvent } from "./types";
import { setEnemyStatus } from "./status-state";
import { rollBattleChance } from "./chance-roll";
import { isPlayerDefeated } from "./health-state";

export function applyTurnStartPurge(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (
    state.enemyHealth <= 0 ||
    isPlayerDefeated(state) ||
    !rollBattleChance(state.gearEffects.turnStartPurgeChance, state)
  )
    return state;
  const purged = purgeEnemyBenefits(state, 1, combatTexts);
  return applyPurgeGearRewards(purged.state, purged.removed, combatTexts);
}

export function purgeEnemyBenefits(
  state: BattleState,
  count: number,
  combatTexts: CombatTextEvent[],
): { state: BattleState; removed: number } {
  let nextState = state;
  let removed = 0;
  while (removed < count && nextState.enemyHealth > 0) {
    const mitigation = nextState.enemyMitigation;
    const category =
      mitigation.armor > 0 ? "armor" : mitigation.block > 0 ? "block" : mitigation.forge > 0 ? "forge" : null;
    const status = beneficialEnemyStatusIds.find((candidate) => nextState.enemyStatuses[candidate] > 0);
    const purged = category ?? status;
    if (!purged) break;
    nextState = category
      ? { ...nextState, enemyMitigation: { ...mitigation, [category]: 0 } }
      : setEnemyStatus(nextState, status!, 0);
    if (purged === "thorns") {
      nextState = { ...nextState, flags: { ...nextState.flags, legacyEnemyThornsReady: false } };
    }
    combatTexts.push({ target: "enemy", kind: "notice", stat: purged, text: "Purged", signal: "purge" });
    removed += 1;
  }
  return { state: nextState, removed };
}

export function applyPurgeGearRewards(
  state: BattleState,
  removed: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (removed <= 0) return state;
  const blocked =
    state.gearEffects.blockOnPurge > 0 ? applyBlockReward(state, state.gearEffects.blockOnPurge, combatTexts) : state;
  return blocked.enemyHealth > 0 && blocked.gearEffects.holyOnPurge > 0
    ? resolveFollowUpHit(
        blocked,
        { source: "player-follow-up", damageType: "holy", amount: blocked.gearEffects.holyOnPurge },
        combatTexts,
      )
    : blocked;
}
