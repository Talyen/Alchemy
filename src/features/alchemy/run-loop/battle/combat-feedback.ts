import type { CombatTextEvent } from "@/lib/battle";
import { COMBAT_TEXT_LIFETIME_MS, COMBAT_TEXT_MIN_LIFETIME_MS, SHAKE_DURATION_MS } from "@/lib/game-constants";
import { resolveGameDelay, TimerGroup } from "@/lib/animation/game-timer";
import type { CombatImpactCue, CombatTextBurst } from "../../shared/types";
import { consolidateCombatBursts } from "./combat-feedback-merge";
import { prepareCombatFeedback } from "./combat-feedback-model";

type Combatant = "player" | "enemy" | "companion";

export interface CombatFeedbackState {
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
}

export interface CombatFeedbackActions {
  shakeEnemy: () => void;
  shakePlayer: () => void;
  shakeCompanion: () => void;
  telegraphAttack: (side: Combatant) => void;
  telegraphCast: (side: Combatant) => void;
  showCombatTexts: (events: CombatTextEvent[]) => void;
  clearFloatingCombatTexts: () => void;
}

export function createCombatFeedbackState(): CombatFeedbackState {
  return {
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
  };
}

interface CombatFeedbackDeps {
  update: (reduce: (state: CombatFeedbackState) => Partial<CombatFeedbackState>) => void;
  isVisible: () => boolean;
  now: () => number;
}

/** One owner for feedback resources; the store remains the sole owner of visible state. */
export function createCombatFeedback({ update, isVisible, now }: CombatFeedbackDeps): {
  actions: CombatFeedbackActions;
  cancel: () => void;
} {
  const textTimers = new TimerGroup();
  const shakeTimers = new TimerGroup();
  const shakeCancels = new Map<Combatant, () => void>();
  let generation = 0;
  let actionId = 0;
  let impactSequence = 0;

  function cancelTexts() {
    generation += 1;
    textTimers.clearAll();
  }

  function shake(side: Combatant) {
    const key = `${side}Shaking` as const;
    shakeCancels.get(side)?.();
    // Arm before publishing: a synchronous subscriber may reset presentation.
    shakeCancels.set(
      side,
      shakeTimers.setTimeout(() => {
        shakeCancels.delete(side);
        update(() => ({ [key]: false }));
      }, SHAKE_DURATION_MS),
    );
    update(() => ({ [key]: true }));
  }

  function telegraph(kind: "Attack" | "Cast", side: Combatant) {
    const key = `${side === "companion" ? "player" : side}${kind}Token` as const;
    update((state) => ({ [key]: state[key] + 1 }));
  }

  return {
    cancel: () => {
      cancelTexts();
      shakeTimers.clearAll();
      shakeCancels.clear();
    },
    actions: {
      shakeEnemy: () => shake("enemy"),
      shakePlayer: () => shake("player"),
      shakeCompanion: () => shake("companion"),
      telegraphAttack: (side) => telegraph("Attack", side),
      telegraphCast: (side) => telegraph("Cast", side),
      showCombatTexts: (events) => {
        if (events.length === 0 || !isVisible()) return;
        const sequence = generation;
        const timestamp = now();
        const lifetimeMs = Math.max(COMBAT_TEXT_MIN_LIFETIME_MS, resolveGameDelay(COMBAT_TEXT_LIFETIME_MS));
        const prepared = prepareCombatFeedback(events, ++actionId, timestamp, lifetimeMs);
        if (prepared.bursts.length === 0) return;
        const impacts: Partial<Pick<CombatFeedbackState, "playerImpactCue" | "enemyImpactCue">> = {};
        for (const key of ["playerImpactCue", "enemyImpactCue"] as const) {
          const visual = prepared.impacts[key];
          if (visual) impacts[key] = { ...visual, sequence: ++impactSequence };
        }
        let added: CombatTextBurst[] = [];
        update((state) => {
          const result = consolidateCombatBursts(state.floatingCombatBursts, prepared.bursts, timestamp);
          added = result.added;
          return { floatingCombatBursts: result.bursts, ...impacts };
        });
        // Subscribers may clear presentation while the update is being published.
        if (sequence !== generation || added.length === 0) return;
        const ids = new Set(added.map((burst) => burst.id));
        textTimers.setTimeout(() => {
          if (sequence !== generation) return;
          update((state) => ({
            floatingCombatBursts: state.floatingCombatBursts.filter((burst) => !ids.has(burst.id)),
          }));
        }, lifetimeMs);
      },
      clearFloatingCombatTexts: () => {
        cancelTexts();
        update(() => ({ floatingCombatBursts: [], playerImpactCue: null, enemyImpactCue: null }));
      },
    },
  };
}
