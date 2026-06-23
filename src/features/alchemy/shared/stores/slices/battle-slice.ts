import { hydrateCard } from "@/lib/game-data";
import type { BattleState } from "@/lib/battle";
import { createInitialBattleFields, type DisplayOverrides } from "../run-domain-types";
import { defineFieldSetter, type ImmerSet } from "./_field-setter";
import type { RunDomainDataState } from "../run-domain-types";

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

export interface BattleActions {
  setSyncedBattleState: (action: BattleState | ((prev: BattleState) => BattleState)) => void;
  setDisplayOverrides: (overrides: DisplayOverrides) => void;
  clearDisplayOverrides: () => void;
  setBattleStartState: (state: BattleState | null) => void;
  setHasActiveBattle: (active: boolean | ((prev: boolean) => boolean)) => void;
  initializeActiveBattle: (battleState: BattleState | null) => void;
}

export function defineBattleActions(set: ImmerSet<RunDomainDataState>): BattleActions & { resetBattle: () => void } {
  interface BattleStateFields {
    battleState: BattleState;
    displayOverrides: DisplayOverrides;
    battleStartState: BattleState | null;
    hasActiveBattle: boolean;
  }
  const setField = defineFieldSetter<BattleStateFields, RunDomainDataState>(set, "battle");

  return {
    setSyncedBattleState: (action) =>
      set((state) => {
        state.battle.battleState = typeof action === "function" ? action(state.battle.battleState) : action;
        state.battle.displayOverrides = {};
      }),

    setDisplayOverrides: setField("displayOverrides"),
    clearDisplayOverrides: () =>
      set((state) => {
        state.battle.displayOverrides = {};
      }),

    setBattleStartState: setField("battleStartState"),
    setHasActiveBattle: setField("hasActiveBattle"),

    initializeActiveBattle: (battleState) =>
      set((state) => {
        if (battleState) {
          const hydrated = hydrateBattleState(battleState);
          state.battle.battleState = hydrated;
          state.battle.displayOverrides = {};
          state.battle.battleStartState = hydrated;
          state.battle.hasActiveBattle = true;
        } else {
          state.battle = createInitialBattleFields();
        }
      }),

    resetBattle: () =>
      set((state) => {
        state.battle = createInitialBattleFields();
      }),
  };
}
