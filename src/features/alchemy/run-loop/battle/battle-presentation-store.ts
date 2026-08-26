import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { readBattle, readRunPhase } from "@/features/alchemy/shared/stores/run-session-read-port";
import { onClearBattlePresentation, onRunTeardown } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import type { CombatTextEvent } from "@/lib/battle";
import {
  COMBAT_TEXT_LANE_DELAY_MS,
  COMBAT_TEXT_LIFETIME_MS,
  COMBAT_TEXT_MAX_VISIBLE_PER_RAIL,
  SHAKE_DURATION,
} from "@/lib/game-constants";
import { resolveGameDelay, TimerGroup } from "@/lib/animation/game-timer";
import type { CardGhost, CardTransfer, CombatImpactCue, FloatingCombatText } from "../../shared/types";
import { getCombatImpactVisual } from "../../shared/utils";
import {
  canonicalizeHiddenHandCardKeys,
  EMPTY_HIDDEN_HAND_KEYS,
  hiddenHandKeysEqual,
  type HiddenHandCardKeys,
} from "./playable-hand";

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
  playerImpactCue: CombatImpactCue | null;
  enemyImpactCue: CombatImpactCue | null;
  playerAttackToken: number;
  enemyAttackToken: number;
  playerCastToken: number;
  enemyCastToken: number;
  cardTransfers: CardTransfer[];
  hiddenHandCardKeys: HiddenHandCardKeys;
  cardTransferInProgress: boolean;

  spawnCardGhost: (ghost: Omit<CardGhost, "id">) => void;
  removeCardGhost: (id: string) => void;
  clearCardGhosts: () => void;
  shakeEnemy: () => void;
  shakePlayer: () => void;
  shakeCompanion: () => void;
  telegraphAttack: (side: "player" | "enemy" | "companion") => void;
  telegraphCast: (side: "player" | "enemy" | "companion") => void;
  showCombatTexts: (events: CombatTextEvent[]) => void;
  clearFloatingCombatTexts: () => void;
  setCardTransfers: (transfers: CardTransfer[] | ((prev: CardTransfer[]) => CardTransfer[])) => void;
  setHiddenHandCardKeys: (update: (prev: HiddenHandCardKeys) => Iterable<string>) => void;
  setCardTransferInProgress: (inProgress: boolean | ((prev: boolean) => boolean)) => void;
  resetHandTransferUi: () => void;
  resetCardTransfers: () => void;
  resetPresentation: () => void;
}

const shakeDuration = SHAKE_DURATION;
const combatTextLifetimeMs = COMBAT_TEXT_LIFETIME_MS;
const combatTextLaneDelayMs = COMBAT_TEXT_LANE_DELAY_MS;

let combatTextSequence = 0;
let combatImpactSequence = 0;
const combatTextTimers = new TimerGroup();
const shakeTimers = new TimerGroup();
type ShakeTarget = "enemy" | "player" | "companion";
const shakeTimerCancels = new Map<ShakeTarget, () => void>();

function scheduleShakeReset(target: ShakeTarget, reset: () => void) {
  shakeTimerCancels.get(target)?.();
  shakeTimerCancels.set(
    target,
    shakeTimers.setTimeout(() => {
      shakeTimerCancels.delete(target);
      reset();
    }, shakeDuration),
  );
}

function clearPresentationTimers() {
  combatTextTimers.clearAll();
  shakeTimers.clearAll();
  shakeTimerCancels.clear();
}

function shouldShowFloatingCombatText(sequence: number): boolean {
  if (sequence !== combatTextSequence) return false;
  const battle = readBattle();
  return battle.hasActiveBattle && readRunPhase() === "battle";
}

function invalidateCombatTextSequence() {
  combatTextSequence += 1;
}

let ghostIdCounter = 0;

export const useBattlePresentationStore = create<BattlePresentationStore>()(
  subscribeWithSelector((set) => ({
    cardGhosts: [],
    floatingCombatTexts: [],
    enemyShaking: false,
    playerShaking: false,
    companionShaking: false,
    playerImpactCue: null,
    enemyImpactCue: null,
    playerAttackToken: 0,
    enemyAttackToken: 0,
    playerCastToken: 0,
    enemyCastToken: 0,
    cardTransfers: [],
    hiddenHandCardKeys: EMPTY_HIDDEN_HAND_KEYS,
    cardTransferInProgress: false,

    spawnCardGhost: (ghost) => {
      const id = `ghost-${++ghostIdCounter}`;
      set((s) => ({ cardGhosts: [...s.cardGhosts, { ...ghost, id }] }));
    },

    removeCardGhost: (id) => set((s) => ({ cardGhosts: s.cardGhosts.filter((g) => g.id !== id) })),

    clearCardGhosts: () => set({ cardGhosts: [] }),

    shakeEnemy: () => {
      set({ enemyShaking: true });
      scheduleShakeReset("enemy", () => set({ enemyShaking: false }));
    },

    shakePlayer: () => {
      set({ playerShaking: true });
      scheduleShakeReset("player", () => set({ playerShaking: false }));
    },

    shakeCompanion: () => {
      set({ companionShaking: true });
      scheduleShakeReset("companion", () => set({ companionShaking: false }));
    },

    telegraphAttack: (side) => {
      if (side === "player" || side === "companion") {
        set((s) => ({ playerAttackToken: s.playerAttackToken + 1 }));
      } else {
        set((s) => ({ enemyAttackToken: s.enemyAttackToken + 1 }));
      }
    },

    telegraphCast: (side) => {
      if (side === "player" || side === "companion") {
        set((s) => ({ playerCastToken: s.playerCastToken + 1 }));
      } else {
        set((s) => ({ enemyCastToken: s.enemyCastToken + 1 }));
      }
    },

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

      const entriesByDelay = new Map<number, FloatingCombatText[]>();
      for (const entry of nextEntries) {
        const entryDelay = resolveGameDelay(entry.lane * combatTextLaneDelayMs);
        const bucket = entriesByDelay.get(entryDelay);
        if (bucket) bucket.push(entry);
        else entriesByDelay.set(entryDelay, [entry]);
      }

      for (const [entryDelay, entries] of entriesByDelay) {
        combatTextTimers.setTimeout(() => {
          if (!shouldShowFloatingCombatText(sequence)) return;
          set((s) => {
            let next = [...s.floatingCombatTexts, ...entries];
            let playerImpactCue: CombatImpactCue | undefined;
            let enemyImpactCue: CombatImpactCue | undefined;
            for (const entry of entries) {
              const visual = getCombatImpactVisual(entry);
              if (!visual) continue;
              const cue = { ...visual, sequence: ++combatImpactSequence } satisfies CombatImpactCue;
              if (entry.target === "player") playerImpactCue = cue;
              else enemyImpactCue = cue;
            }
            for (const side of ["player", "enemy"] as const) {
              const sideEntries = next.filter((entry) => entry.target === side);
              const overflow = sideEntries.length - COMBAT_TEXT_MAX_VISIBLE_PER_RAIL;
              if (overflow <= 0) continue;
              const drop = new Set(sideEntries.slice(0, overflow).map((entry) => entry.id));
              next = next.filter((entry) => !drop.has(entry.id));
            }
            return {
              floatingCombatTexts: next,
              ...(playerImpactCue ? { playerImpactCue } : {}),
              ...(enemyImpactCue ? { enemyImpactCue } : {}),
            };
          });
          const ids = new Set(entries.map((entry) => entry.id));
          combatTextTimers.setTimeout(() => {
            if (sequence !== combatTextSequence) return;
            set((s) => ({ floatingCombatTexts: s.floatingCombatTexts.filter((c) => !ids.has(c.id)) }));
          }, resolveGameDelay(combatTextLifetimeMs));
        }, entryDelay);
      }
    },

    clearFloatingCombatTexts: () => {
      invalidateCombatTextSequence();
      combatTextTimers.clearAll();
      set({ floatingCombatTexts: [], playerImpactCue: null, enemyImpactCue: null });
    },

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
        cardTransferInProgress: typeof inProgress === "function" ? inProgress(s.cardTransferInProgress) : inProgress,
      })),

    resetHandTransferUi: () => set({ hiddenHandCardKeys: EMPTY_HIDDEN_HAND_KEYS, cardTransferInProgress: false }),

    resetCardTransfers: () => set({ cardTransfers: [] }),

    resetPresentation: () => {
      invalidateCombatTextSequence();
      clearPresentationTimers();
      set({
        cardGhosts: [],
        floatingCombatTexts: [],
        enemyShaking: false,
        playerShaking: false,
        companionShaking: false,
        playerImpactCue: null,
        enemyImpactCue: null,
        playerAttackToken: 0,
        enemyAttackToken: 0,
        playerCastToken: 0,
        enemyCastToken: 0,
        cardTransfers: [],
        hiddenHandCardKeys: EMPTY_HIDDEN_HAND_KEYS,
        cardTransferInProgress: false,
      });
    },
  })),
);

onClearBattlePresentation(() => {
  useBattlePresentationStore.getState().resetPresentation();
});

onRunTeardown(() => {
  useBattlePresentationStore.getState().resetPresentation();
});
