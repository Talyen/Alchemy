import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { registerSessionCleanup } from "@/features/alchemy/shared/stores/session-capabilities";
import {
  createCombatFeedback,
  createCombatFeedbackState,
  type CombatFeedbackState,
  type CombatFeedbackActions,
} from "./combat-feedback";
import { createStore } from "zustand/vanilla";
import { subscribeWithSelector } from "zustand/middleware";
import { readBattle, readRunPhase } from "@/features/alchemy/shared/stores/run-reads";
import { onClearBattlePresentation, onRunTeardown } from "@/features/alchemy/shared/stores/run-lifecycle";
import type { BattleSnapshot } from "@/lib/battle";
import type { CardGhost, CardTransfer } from "../../shared/types";
import {
  canonicalizeHiddenHandCardKeys,
  EMPTY_HIDDEN_HAND_KEYS,
  hiddenHandKeysEqual,
  type HiddenHandCardKeys,
} from "./playable-hand";

interface BattlePresentationStateWithActions extends CombatFeedbackState, CombatFeedbackActions {
  openingDrawPending: boolean;
  setOpeningDrawPending: (pending: boolean) => void;
  displayedBattle: BattleSnapshot | null;
  setDisplayedBattle: (state: BattleSnapshot | null) => void;
  cardGhosts: CardGhost[];
  cardTransfers: CardTransfer[];
  hiddenHandCardKeys: HiddenHandCardKeys;
  cardTransferInProgress: boolean;

  spawnCardGhost: (ghost: Omit<CardGhost, "id">) => void;
  removeCardGhost: (id: string) => void;
  clearCardGhosts: () => void;
  setCardTransfers: (transfers: CardTransfer[] | ((prev: CardTransfer[]) => CardTransfer[])) => void;
  setHiddenHandCardKeys: (update: (prev: HiddenHandCardKeys) => Iterable<string>) => void;
  setCardTransferInProgress: (inProgress: boolean | ((prev: boolean) => boolean)) => void;
  resetHandTransferUi: () => void;
  resetCardTransfers: () => void;
  resetPresentation: () => void;
}

const MAX_CARD_GHOSTS = 6;

type BattlePresentationState = Pick<
  BattlePresentationStateWithActions,
  | "openingDrawPending"
  | "displayedBattle"
  | "cardGhosts"
  | "cardTransfers"
  | "hiddenHandCardKeys"
  | "cardTransferInProgress"
>;

function createInitialState(): BattlePresentationState & CombatFeedbackState {
  return {
    ...createCombatFeedbackState(),
    openingDrawPending: false,
    displayedBattle: null,
    cardGhosts: [],
    cardTransfers: [],
    hiddenHandCardKeys: EMPTY_HIDDEN_HAND_KEYS,
    cardTransferInProgress: false,
  };
}

export function createBattlePresentationStore(gameSession: GameSession) {
  const store = createStore<BattlePresentationStateWithActions>()(
    subscribeWithSelector((set) => {
      let ghostIdCounter = 0;
      const feedback = createCombatFeedback({
        update: (reduce) => set(reduce),
        isVisible: () => readBattle(gameSession).hasActiveBattle && readRunPhase(gameSession) === "battle",
        now: () => Date.now(),
      });
      return {
        ...createInitialState(),
        ...feedback.actions,
        setOpeningDrawPending: (openingDrawPending) => set({ openingDrawPending }),
        setDisplayedBattle: (displayedBattle) => set({ displayedBattle }),

        spawnCardGhost: (ghost) => {
          const id = `ghost-${++ghostIdCounter}`;
          // Departing cards finish independently; cap overlapping ghosts so rapid
          // plays shed the oldest instead of stacking canvases (Trinket parity: 6).
          set((s) => ({ cardGhosts: [...s.cardGhosts.slice(-(MAX_CARD_GHOSTS - 1)), { ...ghost, id }] }));
        },

        removeCardGhost: (id) => set((s) => ({ cardGhosts: s.cardGhosts.filter((g) => g.id !== id) })),

        clearCardGhosts: () => set({ cardGhosts: [] }),

        setCardTransfers: (transfers) =>
          set((s) => ({
            cardTransfers: typeof transfers === "function" ? transfers(s.cardTransfers) : transfers,
          })),

        setHiddenHandCardKeys: (update) =>
          set((s) => {
            const next = canonicalizeHiddenHandCardKeys(update(s.hiddenHandCardKeys));
            if (hiddenHandKeysEqual(s.hiddenHandCardKeys, next)) return {};
            return { hiddenHandCardKeys: next };
          }),

        setCardTransferInProgress: (inProgress) =>
          set((s) => ({
            cardTransferInProgress:
              typeof inProgress === "function" ? inProgress(s.cardTransferInProgress) : inProgress,
          })),

        resetHandTransferUi: () => set({ hiddenHandCardKeys: EMPTY_HIDDEN_HAND_KEYS, cardTransferInProgress: false }),

        resetCardTransfers: () => set({ cardTransfers: [] }),

        resetPresentation: () => {
          feedback.cancel();
          set(createInitialState());
        },
      };
    }),
  );

  const reset = () => store.getState().resetPresentation();
  onClearBattlePresentation(reset, gameSession);
  onRunTeardown(reset, gameSession);
  registerSessionCleanup(gameSession, reset);
  return store;
}

export type BattlePresentationStore = ReturnType<typeof createBattlePresentationStore>;
export type BattlePresentationPort = ReturnType<BattlePresentationStore["getState"]>;
