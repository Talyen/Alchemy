import type { BattleState } from "@/lib/battle";
import type { PersistedBattleTransition } from "@/lib/active-run-session";
import { bindDraftAction, type GameplayDraft } from "./run-session-command";
import { createGameplayDraftBattleActions } from "./gameplay-state-store";
import type { DisplayOverrides } from "./run-domain-types";
import { createRunRandomSource } from "./write-port-run";
import { syncPurseFromBattleGold } from "./gold-purse";

const battleActions = (state: GameplayDraft) => createGameplayDraftBattleActions(state);

export function setBattleState(draft: GameplayDraft, action: BattleState | ((prev: BattleState) => BattleState)): void {
  battleActions(draft).setSyncedBattleState(action);
  syncPurseFromBattleGold(draft);
}
export const setBattleStartState = bindDraftAction((s) => battleActions(s).setBattleStartState);
export const setHasActiveBattle = bindDraftAction((s) => battleActions(s).setHasActiveBattle);

function rebindBattleWorldRng(battleState: BattleState): BattleState {
  return { ...battleState, rng: createRunRandomSource("world") };
}

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
  battle.setSyncedBattleState(battleState);
  battle.setPendingBattleTransition(pendingBattleTransition);
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
  battle.setSyncedBattleState(battleState);
  battle.setPendingBattleTransition(pendingBattleTransition);
  battle.setDisplayOverrides(displayOverrides);
  syncPurseFromBattleGold(draft);
}

export function clearBattleTransition(draft: GameplayDraft): void {
  const battle = battleActions(draft);
  battle.setPendingBattleTransition(null);
  battle.clearPendingTransitionResumeRequired();
}
