import type { BattleState, EndPlayerTurnResolution } from "@/lib/battle";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import type { PersistedBattleTransition } from "@/lib/active-run-session";
import { createInitialBattleFields, type DisplayOverrides, type RunDomainBattleState } from "./run-domain-types";
import type { GameplayDraft } from "./run-session-command";
import type { Draft } from "immer";
import { syncPurseFromBattleGold } from "./gold-purse";

function hydrateBattleState(battleState: BattleState): BattleState {
  return {
    ...battleState,
    deck: battleState.deck.map(hydrateCard),
    hand: battleState.hand.map(hydrateCard),
    discard: battleState.discard.map(hydrateCard),
    exhausted: battleState.exhausted.map(hydrateCard),
    wishOptions: battleState.wishOptions ? battleState.wishOptions.map(hydrateCard) : null,
    wishQueue: battleState.wishQueue ? battleState.wishQueue.map((list) => list.map(hydrateCard)) : [],
  };
}

function hydrateBattleTransition(transition: PersistedBattleTransition | null): PersistedBattleTransition | null {
  if (!transition || !("resultState" in transition)) return transition;
  return {
    ...transition,
    resultState: hydrateBattleState(transition.resultState),
  };
}

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

/** Commit the logical combat state and clear stale display overrides. */
export function setSyncedBattleState(
  draft: GameplayDraft,
  action: BattleState | ((prev: BattleState) => BattleState),
): void {
  const prev = draft.battle.battleState;
  draft.battle.battleState = typeof action === "function" ? action(prev) : action;
  draft.battle.displayOverrides = {};
}

export function setBattleState(draft: GameplayDraft, action: BattleState | ((prev: BattleState) => BattleState)): void {
  setSyncedBattleState(draft, (prev) => rebindBattleWorldRng(typeof action === "function" ? action(prev) : action));
  syncPurseFromBattleGold(draft);
}

export function setPendingBattleTransition(draft: GameplayDraft, transition: PersistedBattleTransition | null): void {
  draft.battle.pendingBattleTransition = transition;
}

export function clearPendingTransitionResumeRequired(draft: GameplayDraft): void {
  draft.battle.pendingTransitionResumeRequired = false;
}

export function setDisplayOverrides(draft: GameplayDraft, overrides: DisplayOverrides): void {
  draft.battle.displayOverrides = overrides;
}

export function clearDisplayOverrides(draft: GameplayDraft): void {
  draft.battle.displayOverrides = {};
}

export function setBattleStartState(draft: GameplayDraft, state: BattleState | null): void {
  draft.battle.battleStartState = state;
}

export function setHasActiveBattle(draft: GameplayDraft, active: boolean | ((prev: boolean) => boolean)): void {
  draft.battle.hasActiveBattle = typeof active === "function" ? active(draft.battle.hasActiveBattle) : active;
}

function rebindPendingTransitionWorldRng(
  pendingBattleTransition: PersistedBattleTransition | null,
): PersistedBattleTransition | null {
  if (!pendingBattleTransition || !("resultState" in pendingBattleTransition)) return pendingBattleTransition;
  return {
    ...pendingBattleTransition,
    resultState: rebindBattleWorldRng(pendingBattleTransition.resultState),
  };
}

/** Hydrate and start a battle with resting RNG, or clear combat state entirely when passed `null`. */
export function initializeActiveBattle(
  draft: GameplayDraft,
  battleState: BattleState | null,
  pendingBattleTransition?: PersistedBattleTransition | null,
): void {
  if (!battleState) {
    Object.assign(draft.battle, createInitialBattleFields());
    return;
  }
  const hydrated = rebindBattleWorldRng(hydrateBattleState(battleState));
  const pending = rebindPendingTransitionWorldRng(hydrateBattleTransition(pendingBattleTransition ?? null));
  const battle: Draft<RunDomainBattleState> = draft.battle;
  battle.battleState = hydrated;
  battle.pendingBattleTransition = pending;
  battle.pendingTransitionResumeRequired = pending != null;
  battle.displayOverrides = {};
  battle.battleStartState = hydrated;
  battle.hasActiveBattle = true;
}

/** Commit the logical state and its async continuation as one durable revision. */
export function commitBattleTransition(
  draft: GameplayDraft,
  battleState: BattleState,
  pendingBattleTransition: PersistedBattleTransition | null,
): void {
  setSyncedBattleState(draft, rebindBattleWorldRng(battleState));
  setPendingBattleTransition(draft, rebindPendingTransitionWorldRng(pendingBattleTransition));
  clearPendingTransitionResumeRequired(draft);
  syncPurseFromBattleGold(draft);
}

/** Start a visible async transition while keeping its continuation in the save. */
export function beginBattleTransition(
  draft: GameplayDraft,
  battleState: BattleState,
  pendingBattleTransition: PersistedBattleTransition,
  displayOverrides: DisplayOverrides,
): void {
  setSyncedBattleState(draft, rebindBattleWorldRng(battleState));
  setPendingBattleTransition(draft, rebindPendingTransitionWorldRng(pendingBattleTransition));
  setDisplayOverrides(draft, displayOverrides);
  syncPurseFromBattleGold(draft);
}

export function clearBattleTransition(draft: GameplayDraft): void {
  setPendingBattleTransition(draft, null);
  clearPendingTransitionResumeRequired(draft);
}
