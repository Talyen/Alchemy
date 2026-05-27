import { create } from "zustand";
import {
  defaultBattleState,
  type BattleState,
  type CombatTextEvent,
  type PlayerStatusValues,
  type TurnPhase,
} from "@/lib/battle";
import { hydrateCard, type BattleCard } from "@/lib/game-data";
import { COMBAT_TEXT_LANE_DELAY_MS, COMBAT_TEXT_LIFETIME_MS, SHAKE_DURATION } from "@/lib/game-constants";
import { delay } from "@/lib/animation/game-timer";
import type { CardGhost, FloatingCombatText } from "@/features/alchemy/types";

function getCombatTextDisplayText(event: CombatTextEvent): string {
  if (event.kind === "notice") return event.text;
  if (event.kind === "damage") return `-${event.amount}`;
  const showPlus = event.kind === "heal" || event.kind === "status";
  return `${showPlus ? "+" : ""}${event.amount}`;
}

type DisplayOverrides = {
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
  cardGhosts: CardGhost[];
  floatingCombatTexts: FloatingCombatText[];
  enemyShaking: boolean;
  playerShaking: boolean;
  companionShaking: boolean;
  playerHurtFlashToken: number;
  enemyHurtFlashToken: number;
  revealedCardKeys: Set<string>;

  setSyncedBattleState: (state: BattleState | ((prev: BattleState) => BattleState)) => void;
  setDisplayOverrides: (overrides: DisplayOverrides) => void;
  clearDisplayOverrides: () => void;
  setBattleStartState: (state: BattleState | null) => void;
  setHasActiveBattle: (active: boolean | ((prev: boolean) => boolean)) => void;
  initializeActiveBattle: (battleState: BattleState | null) => void;
  spawnCardGhost: (ghost: Omit<CardGhost, "id">) => void;
  removeCardGhost: (id: string) => void;
  clearCardGhosts: () => void;
  shakeEnemy: () => void;
  shakePlayer: () => void;
  shakeCompanion: () => void;
  hurtPlayer: () => void;
  hurtEnemy: () => void;
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
  displayOverrides: {},
  battleStartState: null,
  hasActiveBattle: false,
  cardGhosts: [],
  floatingCombatTexts: [],
  enemyShaking: false,
  playerShaking: false,
  companionShaking: false,
  playerHurtFlashToken: 0,
  enemyHurtFlashToken: 0,
  revealedCardKeys: new Set(),

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

  hurtPlayer: () => set((s) => ({ playerHurtFlashToken: s.playerHurtFlashToken + 1 })),
  hurtEnemy: () => set((s) => ({ enemyHurtFlashToken: s.enemyHurtFlashToken + 1 })),

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
