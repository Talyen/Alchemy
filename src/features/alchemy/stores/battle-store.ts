import { create } from "zustand";
import { defaultBattleState, type BattleState, type CombatTextEvent } from "@/lib/battle";
import { hydrateCard } from "./run-store";
import { COMBAT_TEXT_LANE_DELAY_MS, COMBAT_TEXT_LIFETIME_MS, SHAKE_DURATION } from "@/lib/game-constants";
import type { CardGhost, FloatingCombatText } from "@/features/alchemy/types";

type ShimmerState = { cardId: string; token: number } | null;

function getCombatTextDisplayText(event: CombatTextEvent): string {
  if (event.kind === "notice") return event.text;
  if (event.kind === "damage") return `-${event.amount}`;
  const showPlus = event.kind === "heal" || event.kind === "status";
  return `${showPlus ? "+" : ""}${event.amount}`;
}

type BattleStore = {
  battleState: BattleState;
  battleStartState: BattleState | null;
  hasActiveBattle: boolean;
  cardGhosts: CardGhost[];
  floatingCombatTexts: FloatingCombatText[];
  enemyShaking: boolean;
  playerShaking: boolean;
  companionShaking: boolean;
  shimmerState: ShimmerState;
  revealedCardKeys: Set<string>;

  setBattleState: (state: BattleState | ((prev: BattleState) => BattleState)) => void;
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
  maybeTriggerShimmer: (cardId: string) => void;
  clearFloatingCombatTexts: () => void;
  addRevealedCardKey: (key: string) => void;
  clearRevealedCardKeys: () => void;
};

const shimmerCooldownMs = 500;
const shakeDuration = SHAKE_DURATION;
const combatTextLifetimeMs = COMBAT_TEXT_LIFETIME_MS;
const combatTextLaneDelayMs = COMBAT_TEXT_LANE_DELAY_MS;

export const useBattleStore = create<BattleStore>()((set, get) => ({
  battleState: defaultBattleState(),
  battleStartState: null,
  hasActiveBattle: false,
  cardGhosts: [],
  floatingCombatTexts: [],
  enemyShaking: false,
  playerShaking: false,
  companionShaking: false,
  shimmerState: null,
  revealedCardKeys: new Set(),

  setBattleState: (action) =>
    set((s) => ({ battleState: typeof action === "function" ? action(s.battleState) : action })),

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
        battleStartState: hydratedState,
        hasActiveBattle: true,
      });
    } else {
      set({
        battleState: defaultBattleState(),
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

    nextEntries.forEach((entry) => {
      const delay = entry.lane * combatTextLaneDelayMs;
      setTimeout(() => {
        set((s) => ({ floatingCombatTexts: [...s.floatingCombatTexts, entry] }));
        setTimeout(
          () => {
            set((s) => ({ floatingCombatTexts: s.floatingCombatTexts.filter((c) => c.id !== entry.id) }));
          },
          combatTextLifetimeMs + entry.lane * combatTextLaneDelayMs,
        );
      }, delay);
    });
  },

  clearFloatingCombatTexts: () => set({ floatingCombatTexts: [] }),

  addRevealedCardKey: (key) => set((s) => ({ revealedCardKeys: new Set(s.revealedCardKeys).add(key) })),

  clearRevealedCardKeys: () => set({ revealedCardKeys: new Set() }),

  maybeTriggerShimmer: (cardId) => {
    const state = get();
    if (state.shimmerState && performance.now() - state.shimmerState.token < shimmerCooldownMs) return;
    set({ shimmerState: { cardId, token: performance.now() } });
  },
}));
