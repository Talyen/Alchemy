import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { bindSessionCapabilities, registerSessionCleanup } from "@/features/alchemy/shared/stores/session-capabilities";
import {
  createCombatFeedback,
  createCombatFeedbackState,
  type CombatFeedbackState,
  type CombatFeedbackActions,
} from "./combat-feedback";
import { createStore } from "zustand/vanilla";
import { TimerGroup } from "@/lib/animation/game-timer";
import { projectMana, MANA_DOCK_EXIT_MS, type ManaPresentation } from "./mana-presentation";
import { createNotificationChannel } from "@/features/alchemy/shared/stores/notification-channel";
import { deepFreeze } from "@/features/alchemy/shared/stores/store-utils";
import { logError } from "@/lib/error-logger";
import { battleSnapshot } from "@/lib/battle";
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
  manaPresentation: ManaPresentation | null;
  setManaDisplay: (mana: number, maxMana: number, animate: boolean) => void;
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
  | "manaPresentation"
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
    manaPresentation: null,
    displayedBattle: null,
    cardGhosts: [],
    cardTransfers: [],
    hiddenHandCardKeys: EMPTY_HIDDEN_HAND_KEYS,
    cardTransferInProgress: false,
  };
}

export type BattlePresentationPort = Readonly<BattlePresentationStateWithActions>;
type PresentationListener = (state: BattlePresentationPort, previous: BattlePresentationPort) => void;
interface SubscriptionOptions<T> {
  equalityFn?: (a: T, b: T) => boolean;
  fireImmediately?: boolean;
}

/** React-compatible reads and session-bound actions; raw store writes stay private. */
export interface BattlePresentationStore {
  readonly getState: () => BattlePresentationPort;
  readonly getInitialState: () => BattlePresentationPort;
  subscribe(this: void, listener: PresentationListener): () => void;
  subscribe<T>(
    this: void,
    selector: (state: BattlePresentationPort) => T,
    listener: (value: T, previous: T) => void,
    options?: SubscriptionOptions<T>,
  ): () => void;
}

export function createBattlePresentationStore(gameSession: GameSession): BattlePresentationStore {
  let active = true;
  let reset!: () => void;
  const store = createStore<BattlePresentationStateWithActions>()((publish) => {
    // Publish complete, frozen roots so even synchronous observers receive
    // immutable state. Only this owner can replace state or install actions.
    const set = (
      change:
        | Partial<BattlePresentationState & CombatFeedbackState>
        | ((state: BattlePresentationPort) => Partial<BattlePresentationState & CombatFeedbackState>),
    ) =>
      publish((state) => {
        const patch = typeof change === "function" ? change(state) : change;
        for (const value of Object.values(patch)) deepFreeze(value);
        return Object.freeze({ ...state, ...patch });
      }, true);
    let ghostIdCounter = 0;
    const manaTimers = new TimerGroup();
    const feedback = createCombatFeedback({
      update: (reduce) => set(reduce),
      isVisible: () => readBattle(gameSession).hasActiveBattle && readRunPhase(gameSession) === "battle",
      now: () => Date.now(),
    });
    const actions: Omit<BattlePresentationStateWithActions, keyof (BattlePresentationState & CombatFeedbackState)> = {
      ...feedback.actions,
      setManaDisplay: (mana, maxMana, animate) => {
        let changed = false;
        set((state) => {
          const previous = state.manaPresentation;
          if (
            previous?.mana === mana &&
            previous.maxMana === maxMana &&
            (animate || (previous.exits.length === 0 && previous.gems.every((gem) => gem.effect === null)))
          )
            return {};
          changed = true;
          return { manaPresentation: projectMana(previous, mana, maxMana, animate) };
        });
        if (!changed) return;
        manaTimers.clearAll();
        const revision = store.getState().manaPresentation?.revision;
        if (store.getState().manaPresentation?.exits.length) {
          manaTimers.setGameTimeout(() => {
            set((state) => {
              const current = state.manaPresentation;
              if (!current || current.revision !== revision) return {};
              return { manaPresentation: { ...current, exits: [] } };
            });
          }, MANA_DOCK_EXIT_MS);
        }
      },
      setOpeningDrawPending: (openingDrawPending) => set({ openingDrawPending }),
      setDisplayedBattle: (displayedBattle) =>
        set({
          displayedBattle: displayedBattle === null ? null : structuredClone(battleSnapshot(displayedBattle)),
        }),

      spawnCardGhost: (ghost) => {
        const id = `ghost-${++ghostIdCounter}`;
        // Departing cards finish independently; cap overlapping ghosts so rapid
        // plays shed the oldest instead of stacking canvases (Trinket parity: 6).
        set((s) => ({
          cardGhosts: [...s.cardGhosts.slice(-(MAX_CARD_GHOSTS - 1)), structuredClone({ ...ghost, id })],
        }));
      },

      removeCardGhost: (id) => set((s) => ({ cardGhosts: s.cardGhosts.filter((g) => g.id !== id) })),

      clearCardGhosts: () => set({ cardGhosts: [] }),

      setCardTransfers: (transfers) =>
        set((s) => ({
          cardTransfers: structuredClone(typeof transfers === "function" ? transfers(s.cardTransfers) : transfers),
        })),

      setHiddenHandCardKeys: (update) =>
        set((s) => {
          const next = canonicalizeHiddenHandCardKeys(update(s.hiddenHandCardKeys));
          if (hiddenHandKeysEqual(s.hiddenHandCardKeys, next)) return {};
          return { hiddenHandCardKeys: next };
        }),

      setCardTransferInProgress: (inProgress) =>
        set((s) => ({
          cardTransferInProgress: typeof inProgress === "function" ? inProgress(s.cardTransferInProgress) : inProgress,
        })),

      resetHandTransferUi: () => set({ hiddenHandCardKeys: EMPTY_HIDDEN_HAND_KEYS, cardTransferInProgress: false }),

      resetCardTransfers: () => set({ cardTransfers: [] }),

      resetPresentation: () => {
        manaTimers.clearAll();
        feedback.cancel();
        set(createInitialState());
      },
    };
    // Disposal must be able to reset private state after public actions have
    // been revoked. Capture that cleanup before binding the outward methods.
    reset = actions.resetPresentation;
    return Object.freeze({ ...deepFreeze(createInitialState()), ...bindSessionCapabilities(gameSession, actions) });
  });

  type State = BattlePresentationPort;
  type Listener = PresentationListener;
  const notifications = createNotificationChannel<Parameters<Listener>>(
    (error) => {
      logError("Battle presentation subscriber failed", "other", undefined, undefined, undefined, error);
    },
    () => active,
  );
  store.subscribe(notifications.publish);
  function subscribe(listener: Listener): () => void;
  function subscribe<T>(
    selector: (state: State) => T,
    listener: (value: T, previous: T) => void,
    options?: SubscriptionOptions<T>,
  ): () => void;
  function subscribe<T>(
    selector: Listener | ((state: State) => T),
    listener?: (value: T, previous: T) => void,
    options?: SubscriptionOptions<T>,
  ): () => void {
    let notify: Listener;
    let fireImmediately: (() => void) | undefined;
    if (listener) {
      const select = selector as (state: State) => T;
      let previous = select(store.getState());
      notify = (state) => {
        const value = select(state);
        if ((options?.equalityFn ?? Object.is)(previous, value)) return;
        const before = previous;
        previous = value;
        listener(value, before);
      };
      if (options?.fireImmediately) fireImmediately = () => listener(previous, previous);
    } else notify = selector;
    const release = registerSessionCleanup(gameSession, notifications.subscribe(notify));
    try {
      fireImmediately?.();
    } catch (error) {
      release();
      throw error;
    }
    return release;
  }
  onClearBattlePresentation(reset, gameSession);
  onRunTeardown(reset, gameSession);
  registerSessionCleanup(gameSession, () => {
    active = false;
    reset();
  });
  return bindSessionCapabilities(gameSession, {
    getState: store.getState,
    getInitialState: store.getInitialState,
    subscribe,
  });
}
