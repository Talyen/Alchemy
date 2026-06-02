import { create } from "zustand";
import { defaultBattleState, type BattleState, type PlayerStatusValues, type TurnPhase } from "@/lib/battle";
import { hydrateCard, type BattleCard } from "@/lib/game-data";

export type DisplayOverrides = {
  /** ⚠️ Shallow-merged via `{ ...battleState, ...displayOverrides }`. Only use
   *  top-level primitive fields. Nested objects (e.g. partial playerStatuses)
   *  would silently replace the entire field. */
  hand?: BattleCard[];
  turnPhase?: TurnPhase;
  playerHealth?: number;
  playerStatuses?: PlayerStatusValues;
};

type BattleStore = {
  /** Authoritative battle state for UI and run-level decisions. */
  battleState: BattleState;
  /** Display-only overrides layered on battleState for UI animation. Cleared on setSyncedBattleState. */
  displayOverrides: DisplayOverrides;
  battleStartState: BattleState | null;
  hasActiveBattle: boolean;

  setSyncedBattleState: (state: BattleState | ((prev: BattleState) => BattleState)) => void;
  setDisplayOverrides: (overrides: DisplayOverrides) => void;
  clearDisplayOverrides: () => void;
  setBattleStartState: (state: BattleState | null) => void;
  setHasActiveBattle: (active: boolean | ((prev: boolean) => boolean)) => void;
  initializeActiveBattle: (battleState: BattleState | null) => void;
};

export const useBattleStore = create<BattleStore>()((set) => ({
  battleState: defaultBattleState(),
  displayOverrides: {},
  battleStartState: null,
  hasActiveBattle: false,

  setSyncedBattleState: (action) =>
    set((s) => {
      const next = typeof action === "function" ? action(s.battleState) : action;
      return { battleState: next, displayOverrides: {} };
    }),

  setDisplayOverrides: (overrides) => set({ displayOverrides: overrides }),

  clearDisplayOverrides: () => set({ displayOverrides: {} }),

  setBattleStartState: (state) => set({ battleStartState: state }),

  setHasActiveBattle: (active) =>
    set((s) => ({ hasActiveBattle: typeof active === "function" ? active(s.hasActiveBattle) : active })),

  initializeActiveBattle: (battleState) => {
    if (battleState) {
      // Preserve portrait hurt tokens on resume so useHurtPulse does not replay VFX from a saved counter.
      const hydratedState: BattleState = {
        ...battleState,
        deck: battleState.deck.map(hydrateCard),
        hand: battleState.hand.map(hydrateCard),
        discard: battleState.discard.map(hydrateCard),
        exhausted: battleState.exhausted.map(hydrateCard),
        wishOptions: battleState.wishOptions ? battleState.wishOptions.map(hydrateCard) : null,
        wishQueue: battleState.wishQueue ? battleState.wishQueue.map((list) => list.map(hydrateCard)) : [],
      };
      set({
        battleState: hydratedState,
        displayOverrides: {},
        battleStartState: hydratedState,
        hasActiveBattle: true,
      });
    } else {
      set({
        battleState: defaultBattleState(),
        displayOverrides: {},
        battleStartState: null,
        hasActiveBattle: false,
      });
    }
  },
}));
