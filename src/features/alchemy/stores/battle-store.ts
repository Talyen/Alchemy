import { create } from "zustand";
import { defaultBattleState, type BattleState, type CombatTextEvent } from "@/lib/battle";
import { hydrateCard } from "@/lib/game-data";
import { COMBAT_TEXT_LANE_DELAY_MS, COMBAT_TEXT_LIFETIME_MS, SHAKE_DURATION } from "@/lib/game-constants";
import { delay } from "@/lib/animation/game-timer";
import type { CardGhost, FloatingCombatText } from "@/features/alchemy/types";

function getCombatTextDisplayText(event: CombatTextEvent): string {
  if (event.kind === "notice") return event.text;
  if (event.kind === "damage") return `-${event.amount}`;
  const showPlus = event.kind === "heal" || event.kind === "status";
  return `${showPlus ? "+" : ""}${event.amount}`;
}

type BattleStore = {
  /**
   * The "visual" battle state that drives the UI. During animation sequences this may
   * temporarily hold an intermediate display state (e.g. showEnemyTurnStart sets a transient
   * hand:[] / turnPhase:"enemy" snapshot). Never read this for run-level decisions.
   */
  battleState: BattleState;
  /**
   * The authoritative resolved state used for run-level decisions (rewards, materials,
   * navigation). Always reflects the true post-resolution state. logicalBattleState must be
   * kept in sync with battleState at every terminal write; use setSyncedBattleState for that.
   * Only skip setLogicalBattleState when intentionally writing a transient display-only state.
   */
  logicalBattleState: BattleState;
  battleStartState: BattleState | null;
  hasActiveBattle: boolean;
  cardGhosts: CardGhost[];
  floatingCombatTexts: FloatingCombatText[];
  enemyShaking: boolean;
  playerShaking: boolean;
  companionShaking: boolean;
  revealedCardKeys: Set<string>;

  setBattleState: (state: BattleState | ((prev: BattleState) => BattleState)) => void;
  setLogicalBattleState: (state: BattleState | ((prev: BattleState) => BattleState)) => void;
  /** Atomically writes both battleState and logicalBattleState in a single Zustand update.
   *  Use this at every terminal state write to keep the two fields in sync. */
  setSyncedBattleState: (state: BattleState | ((prev: BattleState) => BattleState)) => void;
  setBattleStartState: (state: BattleState | null) => void;
  setHasActiveBattle: (active: boolean | ((prev: boolean) => boolean)) => void;
  initializeActiveBattle: (battleState: BattleState | null) => void;
  spawnCardGhost: (ghost: Omit<CardGhost, "id">) => void;
  removeCardGhost: (id: string) => void;
  clearCardGhosts: () => void;
  shakeEnemy: () => void;
  shakePlayer: () => void;
  shakeCompanion: () => void;
  showCombatTexts: (events: CombatTextEvent[]) => void;
  clearFloatingCombatTexts: () => void;
  addRevealedCardKey: (key: string) => void;
  clearRevealedCardKeys: () => void;
};

const shakeDuration = SHAKE_DURATION;
const combatTextLifetimeMs = COMBAT_TEXT_LIFETIME_MS;
const combatTextLaneDelayMs = COMBAT_TEXT_LANE_DELAY_MS;

export const useBattleStore = create<BattleStore>()((set) => ({
  battleState: defaultBattleState(),
  logicalBattleState: defaultBattleState(),
  battleStartState: null,
  hasActiveBattle: false,
  cardGhosts: [],
  floatingCombatTexts: [],
  enemyShaking: false,
  playerShaking: false,
  companionShaking: false,
  revealedCardKeys: new Set(),

  setBattleState: (action) =>
    set((s) => ({ battleState: typeof action === "function" ? action(s.battleState) : action })),

  setLogicalBattleState: (action) =>
    set((s) => ({ logicalBattleState: typeof action === "function" ? action(s.logicalBattleState) : action })),

  setSyncedBattleState: (action) =>
    set((s) => {
      const next = typeof action === "function" ? action(s.battleState) : action;
      return { battleState: next, logicalBattleState: next };
    }),

  setBattleStartState: (state) => set({ battleStartState: state }),

  setHasActiveBattle: (active) =>
    set((s) => ({ hasActiveBattle: typeof active === "function" ? active(s.hasActiveBattle) : active })),

  initializeActiveBattle: (battleState) => {
    if (battleState) {
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
        logicalBattleState: hydratedState,
        battleStartState: hydratedState,
        hasActiveBattle: true,
      });
    } else {
      set({
        battleState: defaultBattleState(),
        logicalBattleState: defaultBattleState(),
        battleStartState: null,
        hasActiveBattle: false,
      });
    }
  },

  spawnCardGhost: (ghost) => {
    const id = `${performance.now()}-${Math.random()}`;
    set((s) => ({ cardGhosts: [...s.cardGhosts, { ...ghost, id }] }));
  },

  removeCardGhost: (id) => set((s) => ({ cardGhosts: s.cardGhosts.filter((g) => g.id !== id) })),

  clearCardGhosts: () => set({ cardGhosts: [] }),

  shakeEnemy: () => {
    set({ enemyShaking: true });
    setTimeout(() => set({ enemyShaking: false }), shakeDuration);
  },

  shakePlayer: () => {
    set({ playerShaking: true });
    setTimeout(() => set({ playerShaking: false }), shakeDuration);
  },

  shakeCompanion: () => {
    set({ companionShaking: true });
    setTimeout(() => set({ companionShaking: false }), shakeDuration);
  },

  showCombatTexts: (events) => {
    if (events.length === 0) return;
    const laneCounts: Record<"player" | "enemy", number> = { player: 0, enemy: 0 };
    const createdAt = performance.now();
    const nextEntries = events.map((event, index) => {
      const lane = laneCounts[event.target];
      laneCounts[event.target] += 1;
      return {
        ...event,
        lane,
        id: `${createdAt}-${event.target}-${event.stat}-${index}`,
        displayText: getCombatTextDisplayText(event),
      } satisfies FloatingCombatText;
    });

    for (const entry of nextEntries) {
      const entryDelay = entry.lane * combatTextLaneDelayMs;
      delay(entryDelay)
        .then(() => {
          set((s) => ({ floatingCombatTexts: [...s.floatingCombatTexts, entry] }));
          return delay(combatTextLifetimeMs);
        })
        .then(() => {
          set((s) => ({ floatingCombatTexts: s.floatingCombatTexts.filter((c) => c.id !== entry.id) }));
        });
    }
  },

  clearFloatingCombatTexts: () => set({ floatingCombatTexts: [] }),

  addRevealedCardKey: (key) => set((s) => ({ revealedCardKeys: new Set(s.revealedCardKeys).add(key) })),

  clearRevealedCardKeys: () => set({ revealedCardKeys: new Set() }),
}));
