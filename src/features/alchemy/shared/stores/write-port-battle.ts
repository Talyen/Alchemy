import type { BattleState, EndPlayerTurnResolution } from "@/lib/battle";
import type { PersistedBattleTransition } from "@/lib/active-run-session";
import { bindDraftAction, type GameplayDraft } from "./run-session-command";
import { createGameplayDraftBattleActions } from "./gameplay-state-store";
import type { DisplayOverrides } from "./run-domain-types";
import { syncPurseFromBattleGold } from "./gold-purse";

const battleActions = (state: GameplayDraft) => createGameplayDraftBattleActions(state);

function restingWorldRng(): () => number {
  return () => {
    throw new Error("Battle world RNG must be drawn inside dispatchRunSessionCommand via withDraftWorldBattleRng");
  };
}

function rebindBattleWorldRng(battleState: BattleState): BattleState {
  return { ...battleState, rng: restingWorldRng() };
}

/** Replace a recipe-local world rng with the throwing resting callback before returning from a command. */
export function withRestingWorldBattleRng(_draft: GameplayDraft, battleState: BattleState): BattleState {
  return rebindBattleWorldRng(battleState);
}

export function withRestingEndPlayerTurnResolution(
  draft: GameplayDraft,
  result: EndPlayerTurnResolution,
): EndPlayerTurnResolution {
  const state = withRestingWorldBattleRng(draft, result.state);
  const afterAttack = result.afterAttackState
    ? { afterAttackState: withRestingWorldBattleRng(draft, result.afterAttackState) }
    : {};
  if (result.kind === "haste") {
    return { ...result, state, ...afterAttack };
  }
  return {
    ...result,
    state,
    enemyTurnStartState: withRestingWorldBattleRng(draft, result.enemyTurnStartState),
    ...afterAttack,
  };
}

function applyBattleSnapshot(
  action: BattleState | ((prev: BattleState) => BattleState),
  prev: BattleState,
): BattleState {
  const next = typeof action === "function" ? action(prev) : action;
  return rebindBattleWorldRng(next);
}

export function setBattleState(draft: GameplayDraft, action: BattleState | ((prev: BattleState) => BattleState)): void {
  battleActions(draft).setSyncedBattleState((prev) => applyBattleSnapshot(action, prev));
  syncPurseFromBattleGold(draft);
}
export const setBattleStartState = bindDraftAction((s) => battleActions(s).setBattleStartState);
export const setHasActiveBattle = bindDraftAction((s) => battleActions(s).setHasActiveBattle);

function rebindPendingTransitionWorldRng(
  pendingBattleTransition: PersistedBattleTransition | null,
): PersistedBattleTransition | null {
  if (!pendingBattleTransition || pendingBattleTransition.kind !== "enemy-turn") return pendingBattleTransition;
  return {
    ...pendingBattleTransition,
    resultState: rebindBattleWorldRng(pendingBattleTransition.resultState),
  };
}

export function initializeActiveBattle(
  draft: GameplayDraft,
  battleState: BattleState | null,
  pendingBattleTransition?: PersistedBattleTransition | null,
): void {
  const battle = battleActions(draft);
  if (!battleState) {
    battle.initializeActiveBattle(null, null);
    return;
  }
  battle.initializeActiveBattle(
    rebindBattleWorldRng(battleState),
    rebindPendingTransitionWorldRng(pendingBattleTransition ?? null),
  );
}

/** Commit the logical state and its async continuation as one durable revision. */
export function commitBattleTransition(
  draft: GameplayDraft,
  battleState: BattleState,
  pendingBattleTransition: PersistedBattleTransition | null,
): void {
  const battle = battleActions(draft);
  battle.setSyncedBattleState(rebindBattleWorldRng(battleState));
  battle.setPendingBattleTransition(rebindPendingTransitionWorldRng(pendingBattleTransition));
  battle.clearPendingTransitionResumeRequired();
  syncPurseFromBattleGold(draft);
}

/** Start a visible async transition while keeping its continuation in the save. */
export function beginBattleTransition(
  draft: GameplayDraft,
  battleState: BattleState,
  pendingBattleTransition: PersistedBattleTransition,
  displayOverrides: DisplayOverrides,
): void {
  const battle = battleActions(draft);
  battle.setSyncedBattleState(rebindBattleWorldRng(battleState));
  battle.setPendingBattleTransition(rebindPendingTransitionWorldRng(pendingBattleTransition));
  battle.setDisplayOverrides(displayOverrides);
  syncPurseFromBattleGold(draft);
}

export function clearBattleTransition(draft: GameplayDraft): void {
  const battle = battleActions(draft);
  battle.setPendingBattleTransition(null);
  battle.clearPendingTransitionResumeRequired();
}
