import { create } from "zustand";
import { getRunSession } from "@/features/alchemy/shared/stores/run-session-model";
import { readBattle } from "@/features/alchemy/shared/stores/run-session-read-port";
import { registerBattlePresentationBridge } from "../../shared/stores/battle-presentation-bridge";
import type { CombatTextEvent } from "@/lib/battle";
import { COMBAT_TEXT_LANE_DELAY_MS, COMBAT_TEXT_LIFETIME_MS, SHAKE_DURATION } from "@/lib/game-constants";
import { delay } from "@/lib/animation/game-timer";
import type { CardGhost, CardTransfer, FloatingCombatText } from "../../shared/types";

function getCombatTextDisplayText(event: CombatTextEvent): string {
  if (event.kind === "notice") return event.text;
  if (event.kind === "damage") return `-${event.amount}`;
  const showPlus = event.kind === "heal" || event.kind === "status";
  return `${showPlus ? "+" : ""}${event.amount}`;
}

interface BattlePresentationStore {
  cardGhosts: CardGhost[];
  floatingCombatTexts: FloatingCombatText[];
  enemyShaking: boolean;
  playerShaking: boolean;
  companionShaking: boolean;
  playerHurtFlashToken: number;
  enemyHurtFlashToken: number;
  revealedCardKeys: Set<string>;
  cardTransfers: CardTransfer[];
  hiddenHandCardKeys: Set<string>;
  cardTransferInProgress: boolean;

  spawnCardGhost: (ghost: Omit<CardGhost, "id">) => void;
  removeCardGhost: (id: string) => void;
  clearCardGhosts: () => void;
  shakeEnemy: () => void;
  shakePlayer: () => void;
  shakeCompanion: () => void;
  hurtPlayer: () => void;
  hurtEnemy: () => void;
  resetPortraitHurtTokens: () => void;
  showCombatTexts: (events: CombatTextEvent[]) => void;
  clearFloatingCombatTexts: () => void;
  addRevealedCardKey: (key: string) => void;
  clearRevealedCardKeys: () => void;
  setCardTransfers: (transfers: CardTransfer[] | ((prev: CardTransfer[]) => CardTransfer[])) => void;
  setHiddenHandCardKeys: (keys: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setCardTransferInProgress: (inProgress: boolean | ((prev: boolean) => boolean)) => void;
  resetHandTransferUi: () => void;
  resetCardTransfers: () => void;
  resetPresentation: () => void;
}

const shakeDuration = SHAKE_DURATION;
const combatTextLifetimeMs = COMBAT_TEXT_LIFETIME_MS;
const combatTextLaneDelayMs = COMBAT_TEXT_LANE_DELAY_MS;

let combatTextSequence = 0;

function shouldShowFloatingCombatText(sequence: number): boolean {
  if (sequence !== combatTextSequence) return false;
  const battle = readBattle();
  return battle.hasActiveBattle && getRunSession().screen === "battle";
}

function invalidateCombatTextSequence() {
  combatTextSequence += 1;
}

export const useBattlePresentationStore = create<BattlePresentationStore>()((set) => ({
  cardGhosts: [],
  floatingCombatTexts: [],
  enemyShaking: false,
  playerShaking: false,
  companionShaking: false,
  playerHurtFlashToken: 0,
  enemyHurtFlashToken: 0,
  revealedCardKeys: new Set(),
  cardTransfers: [],
  hiddenHandCardKeys: new Set(),
  cardTransferInProgress: false,

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

  resetPortraitHurtTokens: () => set({ playerHurtFlashToken: 0, enemyHurtFlashToken: 0 }),

  showCombatTexts: (events) => {
    if (events.length === 0) return;
    const sequence = combatTextSequence;
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
      void delay(entryDelay)
        .then(() => {
          if (!shouldShowFloatingCombatText(sequence)) return;
          set((s) => ({ floatingCombatTexts: [...s.floatingCombatTexts, entry] }));
          return delay(combatTextLifetimeMs);
        })
        .then((res) => {
          if (res === undefined || sequence !== combatTextSequence) return;
          set((s) => ({ floatingCombatTexts: s.floatingCombatTexts.filter((c) => c.id !== entry.id) }));
        });
    }
  },

  clearFloatingCombatTexts: () => {
    invalidateCombatTextSequence();
    set({ floatingCombatTexts: [] });
  },

  addRevealedCardKey: (key) => set((s) => ({ revealedCardKeys: new Set(s.revealedCardKeys).add(key) })),

  clearRevealedCardKeys: () => set({ revealedCardKeys: new Set() }),

  setCardTransfers: (transfers) =>
    set((s) => ({
      cardTransfers: typeof transfers === "function" ? transfers(s.cardTransfers) : transfers,
    })),

  setHiddenHandCardKeys: (keys) =>
    set((s) => ({
      hiddenHandCardKeys: typeof keys === "function" ? keys(s.hiddenHandCardKeys) : keys,
    })),

  setCardTransferInProgress: (inProgress) =>
    set((s) => ({
      cardTransferInProgress: typeof inProgress === "function" ? inProgress(s.cardTransferInProgress) : inProgress,
    })),

  resetHandTransferUi: () => set({ hiddenHandCardKeys: new Set(), cardTransferInProgress: false }),

  resetCardTransfers: () => set({ cardTransfers: [] }),

  resetPresentation: () => {
    invalidateCombatTextSequence();
    set({
      cardGhosts: [],
      floatingCombatTexts: [],
      enemyShaking: false,
      playerShaking: false,
      companionShaking: false,
      playerHurtFlashToken: 0,
      enemyHurtFlashToken: 0,
      revealedCardKeys: new Set(),
      cardTransfers: [],
      hiddenHandCardKeys: new Set(),
      cardTransferInProgress: false,
    });
  },
}));

registerBattlePresentationBridge({
  clearCardGhosts: () => useBattlePresentationStore.getState().clearCardGhosts(),
  resetPresentation: () => useBattlePresentationStore.getState().resetPresentation(),
});
