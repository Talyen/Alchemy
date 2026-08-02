import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import type { BattleState } from "@/lib/battle";
import type { PersistedBattleTransition } from "@/lib/active-run-session";
import { createInitialBattleFields, type DisplayOverrides, type RunDomainBattleState } from "../run-domain-types";
import { defineNestedFieldSetter, type ImmerSet } from "./_field-setter";

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
  if (!transition || transition.kind !== "enemy-turn") return transition;
  return {
    ...transition,
    resultState: hydrateBattleState(transition.resultState),
  };
}

export interface BattleActions {
  setSyncedBattleState: (action: BattleState | ((prev: BattleState) => BattleState)) => void;
  setPendingBattleTransition: (transition: PersistedBattleTransition | null) => void;
  clearPendingTransitionResumeRequired: () => void;
  setDisplayOverrides: (overrides: DisplayOverrides) => void;
  clearDisplayOverrides: () => void;
  setBattleStartState: (state: BattleState | null) => void;
  setHasActiveBattle: (active: boolean | ((prev: boolean) => boolean)) => void;
  /** Hydrate and start a battle, or clear combat state entirely when passed `null`. */
  initializeActiveBattle: (
    battleState: BattleState | null,
    pendingBattleTransition?: PersistedBattleTransition | null,
  ) => void;
}

/** Active-combat actions over root-level {@link RunDomainBattleState}. */
export function defineBattleActions(set: ImmerSet<RunDomainBattleState>): BattleActions {
  const setField = defineNestedFieldSetter<RunDomainBattleState, RunDomainBattleState>(set, (state) => state);

  return {
    setSyncedBattleState: (action) =>
      set((state) => {
        state.battleState = typeof action === "function" ? action(state.battleState) : action;
        state.displayOverrides = {};
      }),

    setPendingBattleTransition: (transition) =>
      set((state) => {
        state.pendingBattleTransition = transition;
      }),

    clearPendingTransitionResumeRequired: () =>
      set((state) => {
        state.pendingTransitionResumeRequired = false;
      }),

    setDisplayOverrides: setField("displayOverrides"),
    clearDisplayOverrides: () =>
      set((state) => {
        state.displayOverrides = {};
      }),

    setBattleStartState: setField("battleStartState"),
    setHasActiveBattle: setField("hasActiveBattle"),

    initializeActiveBattle: (battleState, pendingBattleTransition = null) =>
      set((state) => {
        if (battleState) {
          const hydrated = hydrateBattleState(battleState);
          const pending = hydrateBattleTransition(pendingBattleTransition);
          state.battleState = hydrated;
          state.pendingBattleTransition = pending;
          state.pendingTransitionResumeRequired = pending != null;
          state.displayOverrides = {};
          state.battleStartState = hydrated;
          state.hasActiveBattle = true;
        } else {
          Object.assign(state, createInitialBattleFields());
        }
      }),
  };
}
