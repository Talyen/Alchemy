import type { CombatTextEvent } from "@/lib/battle";
import {
  CARD_REJECTION_FEEDBACK_MS,
  COMBAT_RECOIL_COOLDOWN_MS,
  COMBAT_TEXT_LIFETIME_MS,
  COMBAT_TEXT_MIN_LIFETIME_MS,
  SHAKE_DURATION_MS,
} from "@/lib/game-constants";
import { resolveGameDelay, TimerGroup } from "@/lib/animation/game-timer";
import type { CombatImpactCue, CombatTextBurst, ReactionAnnouncement } from "../../shared/types";
import { consolidateCombatBursts } from "./combat-feedback-merge";
import { prepareCombatFeedback } from "./combat-feedback-model";
import { advanceCombatFeedback, scheduleCombatFeedback, nextCombatFeedbackDeadline } from "./combat-feedback-queue";
import { shouldReduceMotion } from "@/lib/animation/animation-prefs";

type Combatant = "player" | "enemy" | "companion";

export interface CombatFeedbackState {
  floatingCombatBursts: CombatTextBurst[];
  reactionAnnouncements: ReactionAnnouncement[];
  cardRejection: { cardKey: string; mana: boolean } | null;
  enemyShaking: boolean;
  playerShaking: boolean;
  companionShaking: boolean;
  playerImpactCue: CombatImpactCue | null;
  enemyImpactCue: CombatImpactCue | null;
  playerAttackToken: number;
  enemyAttackToken: number;
  playerCastToken: number;
  enemyCastToken: number;
  playerDodgeToken: number;
  enemyDodgeToken: number;
}

export interface CombatFeedbackActions {
  rejectCardPlay: (cardKey: string, mana: boolean) => boolean;
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
    reactionAnnouncements: [],
    cardRejection: null,
    enemyShaking: false,
    playerShaking: false,
    companionShaking: false,
    playerImpactCue: null,
    enemyImpactCue: null,
    playerAttackToken: 0,
    enemyAttackToken: 0,
    playerCastToken: 0,
    enemyCastToken: 0,
    playerDodgeToken: 0,
    enemyDodgeToken: 0,
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
  const rejectionTimers = new TimerGroup();
  const lastImpact = new Map<string, number>();
  let rejecting = false;
  const shakeCancels = new Map<Combatant, () => void>();
  let generation = 0;
  let actionId = 0;
  let impactSequence = 0;
  let textPlanRevision = 0;
  let cancelTextDeadline: (() => void) | undefined;

  function cancelTexts() {
    generation += 1;
    textTimers.clearAll();
    cancelTextDeadline = undefined;
    textPlanRevision += 1;
  }

  function armTextDeadline(deadline: number, sequence: number) {
    cancelTextDeadline?.();
    cancelTextDeadline = undefined;
    if (!Number.isFinite(deadline) || sequence !== generation) return;
    cancelTextDeadline = textTimers.setTimeout(
      () => {
        if (sequence !== generation) return;
        cancelTextDeadline = undefined;
        const revision = ++textPlanRevision;
        let next = Infinity;
        update((state) => {
          const advanced = advanceCombatFeedback(state.floatingCombatBursts, state.reactionAnnouncements, now());
          next = nextCombatFeedbackDeadline(advanced.floatingCombatBursts, advanced.reactionAnnouncements);
          return advanced;
        });
        if (sequence === generation && revision === textPlanRevision) armTextDeadline(next, sequence);
      },
      Math.max(0, deadline - now()),
    );
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
      rejectionTimers.clearAll();
      rejecting = false;
      lastImpact.clear();
      shakeCancels.clear();
    },
    actions: {
      rejectCardPlay: (cardKey, mana) => {
        if (rejecting || !isVisible()) return false;
        rejecting = true;
        rejectionTimers.setTimeout(() => {
          rejecting = false;
          update(() => ({ cardRejection: null }));
        }, CARD_REJECTION_FEEDBACK_MS);
        update(() => ({ cardRejection: { cardKey, mana } }));
        return true;
      },
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
        if (prepared.bursts.length === 0 && prepared.reactions.length === 0) return;
        const revision = ++textPlanRevision;
        let dodged: Set<Combatant> | undefined;
        for (const event of events) {
          if (event.kind === "notice" && event.stat === "dodge") (dodged ??= new Set()).add(event.target);
        }
        const impacts: Partial<Pick<CombatFeedbackState, "playerImpactCue" | "enemyImpactCue">> = {};
        for (const key of ["playerImpactCue", "enemyImpactCue"] as const) {
          const visual = prepared.impacts[key];
          // Keep outcomes and sounds immediate while bounding repeated portrait motion.
          if (visual) {
            const recoil = timestamp - (lastImpact.get(key) ?? -Infinity) >= COMBAT_RECOIL_COOLDOWN_MS;
            if (recoil) lastImpact.set(key, timestamp);
            impacts[key] = { ...visual, recoil, sequence: ++impactSequence };
          }
        }
        let deadline = Infinity;
        update((state) => {
          const current = advanceCombatFeedback(state.floatingCombatBursts, state.reactionAnnouncements, timestamp);
          const bursts = consolidateCombatBursts(current.floatingCombatBursts, prepared.bursts, timestamp);
          const scheduled = scheduleCombatFeedback(
            bursts,
            [...current.reactionAnnouncements, ...prepared.reactions],
            timestamp,
            lifetimeMs,
            shouldReduceMotion(),
          );
          deadline = nextCombatFeedbackDeadline(scheduled.floatingCombatBursts, scheduled.reactionAnnouncements);
          return {
            ...scheduled,
            ...impacts,
            playerDodgeToken: state.playerDodgeToken + Number(dodged?.has("player") ?? false),
            enemyDodgeToken: state.enemyDodgeToken + Number(dodged?.has("enemy") ?? false),
          };
        });
        // A subscriber may reset or admit newer text during publication. Its
        // queue, rather than this older plan, owns the next deadline.
        if (sequence !== generation || revision !== textPlanRevision) return;
        armTextDeadline(deadline, sequence);
      },
      clearFloatingCombatTexts: () => {
        cancelTexts();
        update(() => ({
          floatingCombatBursts: [],
          reactionAnnouncements: [],
          playerImpactCue: null,
          enemyImpactCue: null,
          playerDodgeToken: 0,
          enemyDodgeToken: 0,
        }));
      },
    },
  };
}
