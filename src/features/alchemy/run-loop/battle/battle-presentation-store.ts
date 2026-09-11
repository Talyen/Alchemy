import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { readBattle, readRunPhase } from "@/features/alchemy/shared/stores/run-reads";
import { onClearBattlePresentation, onRunTeardown } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { mergeCombatText, type BattleSnapshot, type CombatTextEvent } from "@/lib/battle";
import {
  COMBAT_TEXT_LIFETIME_MS,
  COMBAT_TEXT_MIN_LIFETIME_MS,
  COMBAT_TEXT_MAX_BURSTS_PER_RAIL,
  SHAKE_DURATION,
} from "@/lib/game-constants";
import { resolveGameDelay, TimerGroup } from "@/lib/animation/game-timer";
import type { CardGhost, CardTransfer, CombatImpactCue, CombatTextBurst } from "../../shared/types";
import type { CombatTextShakeFeedback } from "./battle-status";
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
  openingDrawPending: boolean;
  setOpeningDrawPending: (pending: boolean) => void;
  displayedBattle: BattleSnapshot | null;
  setDisplayedBattle: (state: BattleSnapshot | null) => void;
  cardGhosts: CardGhost[];
  floatingCombatBursts: CombatTextBurst[];
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

let combatTextId = 0;

function invalidateCombatTextSequence() {
  combatTextSequence += 1;
}

let ghostIdCounter = 0;

type BattlePresentationState = Pick<
  BattlePresentationStore,
  | "openingDrawPending"
  | "displayedBattle"
  | "cardGhosts"
  | "floatingCombatBursts"
  | "enemyShaking"
  | "playerShaking"
  | "companionShaking"
  | "playerImpactCue"
  | "enemyImpactCue"
  | "playerAttackToken"
  | "enemyAttackToken"
  | "playerCastToken"
  | "enemyCastToken"
  | "cardTransfers"
  | "hiddenHandCardKeys"
  | "cardTransferInProgress"
>;

const INITIAL_BATTLE_PRESENTATION_STATE: BattlePresentationState = {
  openingDrawPending: false,
  displayedBattle: null,
  cardGhosts: [],
  floatingCombatBursts: [],
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
};

export const useBattlePresentationStore = create<BattlePresentationStore>()(
  subscribeWithSelector((set) => ({
    ...INITIAL_BATTLE_PRESENTATION_STATE,
    setOpeningDrawPending: (openingDrawPending) => set({ openingDrawPending }),
    setDisplayedBattle: (displayedBattle) => set({ displayedBattle }),

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
      const sequence = combatTextSequence;
      if (events.length === 0 || !shouldShowFloatingCombatText(sequence)) return;
      const consolidated: CombatTextEvent[] = [];
      // Resolved frames can be saved and replayed; presentation must never mutate their events.
      for (const event of events) mergeCombatText(consolidated, { ...event });
      const priority = (event: CombatTextEvent) => (event.kind === "notice" ? 0 : event.kind === "damage" ? 1 : 2);
      consolidated.sort((a, b) => priority(a) - priority(b));
      const lifetimeMs = Math.max(COMBAT_TEXT_MIN_LIFETIME_MS, resolveGameDelay(COMBAT_TEXT_LIFETIME_MS));
      const actionId = ++combatTextId;
      const bursts: CombatTextBurst[] = [];
      const impacts: Partial<Record<"playerImpactCue" | "enemyImpactCue", CombatImpactCue>> = {};
      for (const target of ["player", "enemy"] as const) {
        const entries = consolidated.filter((event) => event.target === target);
        if (entries.length === 0) continue;
        const id = `combat-burst-${actionId}-${target}`;
        bursts.push({
          id,
          target,
          lifetimeMs,
          entries: entries.map((event, index) => ({
            ...event,
            id: `${id}-${index}`,
            displayText: getCombatTextDisplayText(event),
          })),
        });
        let strongest: { amount: number; visual: NonNullable<ReturnType<typeof getCombatImpactVisual>> } | undefined;
        for (const entry of entries) {
          const visual = getCombatImpactVisual(entry);
          if (!visual || entry.kind !== "damage") continue;
          if (
            !strongest ||
            (visual.healthLost && !strongest.visual.healthLost) ||
            (visual.healthLost === strongest.visual.healthLost && entry.amount > strongest.amount)
          ) {
            strongest = { amount: entry.amount, visual };
          }
        }
        if (strongest)
          impacts[target === "player" ? "playerImpactCue" : "enemyImpactCue"] = {
            ...strongest.visual,
            sequence: ++combatImpactSequence,
          };
      }
      if (bursts.length === 0) return;
      set((s) => {
        const all = [...s.floatingCombatBursts, ...bursts];
        return {
          floatingCombatBursts: all.filter(
            (burst, index) =>
              all.slice(index + 1).filter((later) => later.target === burst.target).length <
              COMBAT_TEXT_MAX_BURSTS_PER_RAIL,
          ),
          ...impacts,
        };
      });
      const ids = new Set(bursts.map((burst) => burst.id));
      combatTextTimers.setTimeout(() => {
        if (sequence !== combatTextSequence) return;
        set((s) => ({ floatingCombatBursts: s.floatingCombatBursts.filter((burst) => !ids.has(burst.id)) }));
      }, lifetimeMs);
    },

    clearFloatingCombatTexts: () => {
      invalidateCombatTextSequence();
      combatTextTimers.clearAll();
      set({ floatingCombatBursts: [], playerImpactCue: null, enemyImpactCue: null });
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
      set(INITIAL_BATTLE_PRESENTATION_STATE);
    },
  })),
);

onClearBattlePresentation(() => {
  useBattlePresentationStore.getState().resetPresentation();
});

onRunTeardown(() => {
  useBattlePresentationStore.getState().resetPresentation();
});

export type BattlePresentationPort = Pick<
  ReturnType<typeof useBattlePresentationStore.getState>,
  | "hiddenHandCardKeys"
  | "cardTransferInProgress"
  | "setDisplayedBattle"
  | "setOpeningDrawPending"
  | "spawnCardGhost"
  | "showCombatTexts"
  | "shakeCompanion"
  | "telegraphAttack"
  | "telegraphCast"
  | "resetHandTransferUi"
  | "resetCardTransfers"
  | "clearCardGhosts"
  | "clearFloatingCombatTexts"
  | "setCardTransfers"
  | "setHiddenHandCardKeys"
  | "setCardTransferInProgress"
  | "resetPresentation"
> &
  CombatTextShakeFeedback;
