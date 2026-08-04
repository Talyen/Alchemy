// Battle write capability. Feature code receives battle data through readBattle();
// all gameplay mutations enter the aggregate through these commands.
import type { BattleState } from "@/lib/battle";
import type { PersistedBattleTransition } from "@/lib/active-run-session";
import type { DisplayOverrides } from "../run-domain-types";
import { dispatchRunSessionCommand } from "../run-session-command";
import { readGameplayState, type GameplayState } from "../gameplay-state-store";
import { createRunRandomSource } from "./run-domain-write-port";

type BattleStateUpdate = BattleState | ((previous: BattleState) => BattleState);
type BattleActions = GameplayState["battleActions"];

function dispatchBattleCommand<T>(work: (battle: BattleActions) => T): T {
  return dispatchRunSessionCommand(() => work(readGameplayState().battleActions));
}

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

export function setBattleState(action: BattleStateUpdate): void {
  dispatchBattleCommand((battle) => battle.setSyncedBattleState(action));
}

export function setBattleStartState(state: BattleState | null): void {
  dispatchBattleCommand((battle) => battle.setBattleStartState(state));
}

export function setHasActiveBattle(active: boolean | ((previous: boolean) => boolean)): void {
  dispatchBattleCommand((battle) => battle.setHasActiveBattle(active));
}

export function initializeActiveBattle(
  battleState: BattleState | null,
  pendingBattleTransition: PersistedBattleTransition | null = null,
): void {
  if (!battleState) {
    dispatchBattleCommand((battle) => battle.initializeActiveBattle(null, null));
    return;
  }
  dispatchBattleCommand((battle) =>
    battle.initializeActiveBattle(
      rebindBattleWorldRng(battleState),
      rebindPendingTransitionWorldRng(pendingBattleTransition),
    ),
  );
}

/** Commit the logical state and its async continuation as one durable revision. */
export function commitBattleTransition(
  battleState: BattleState,
  pendingBattleTransition: PersistedBattleTransition | null,
): void {
  dispatchBattleCommand((battle) => {
    battle.setSyncedBattleState(battleState);
    battle.setPendingBattleTransition(pendingBattleTransition);
    battle.clearPendingTransitionResumeRequired();
  });
}

/** Start a visible async transition while keeping its continuation in the save. */
export function beginBattleTransition(
  battleState: BattleState,
  pendingBattleTransition: PersistedBattleTransition,
  displayOverrides: DisplayOverrides,
): void {
  dispatchBattleCommand((battle) => {
    battle.setSyncedBattleState(battleState);
    battle.setPendingBattleTransition(pendingBattleTransition);
    battle.setDisplayOverrides(displayOverrides);
  });
}

export function clearBattleTransition(): void {
  dispatchBattleCommand((battle) => {
    battle.setPendingBattleTransition(null);
    battle.clearPendingTransitionResumeRequired();
  });
}
