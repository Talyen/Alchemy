import { create } from "zustand";
import type { CombatTextEvent } from "@/lib/battle";
import { COMBAT_TEXT_LANE_DELAY_MS, COMBAT_TEXT_LIFETIME_MS, SHAKE_DURATION } from "@/lib/game-constants";
import { delay } from "@/lib/animation/game-timer";
import type { CardGhost, FloatingCombatText } from "@/features/alchemy/battle/presentation-types";

function getCombatTextDisplayText(event: CombatTextEvent): string {
  if (event.kind === "notice") return event.text;
  if (event.kind === "damage") return `-${event.amount}`;
  const showPlus = event.kind === "heal" || event.kind === "status";
  return `${showPlus ? "+" : ""}${event.amount}`;
}

type BattlePresentationStore = {
  cardGhosts: CardGhost[];
  floatingCombatTexts: FloatingCombatText[];
  enemyShaking: boolean;
  playerShaking: boolean;
  companionShaking: boolean;
  playerHurtFlashToken: number;
  enemyHurtFlashToken: number;
  revealedCardKeys: Set<string>;

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
  resetPresentation: () => void;
};

const shakeDuration = SHAKE_DURATION;
const combatTextLifetimeMs = COMBAT_TEXT_LIFETIME_MS;
const combatTextLaneDelayMs = COMBAT_TEXT_LANE_DELAY_MS;

export const useBattlePresentationStore = create<BattlePresentationStore>()((set) => ({
  cardGhosts: [],
  floatingCombatTexts: [],
  enemyShaking: false,
  playerShaking: false,
  companionShaking: false,
  playerHurtFlashToken: 0,
  enemyHurtFlashToken: 0,
  revealedCardKeys: new Set(),

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

  resetPresentation: () =>
    set({
      cardGhosts: [],
      floatingCombatTexts: [],
      enemyShaking: false,
      playerShaking: false,
      companionShaking: false,
      playerHurtFlashToken: 0,
      enemyHurtFlashToken: 0,
      revealedCardKeys: new Set(),
    }),
}));
