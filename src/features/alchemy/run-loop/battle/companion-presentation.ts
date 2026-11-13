import { isAttackCard, type BattleSnapshot, type CompanionActionCue } from "@/lib/battle";
import { TimerGroup } from "@/lib/animation/game-timer";
import { shouldReduceMotion } from "@/lib/animation/animation-prefs";
import {
  ATTACK_LUNGE_DURATION_MS,
  ATTACK_SWING_APEX_MS,
  CAST_BRACE_DURATION_MS,
  CAST_BRACE_APEX_MS,
} from "@/lib/game-constants";
import type { BattlePresentationPort } from "./battle-presentation-store";

export interface CompanionPlaybackCue extends CompanionActionCue {
  sequence: number;
}

/** Serial presentation only. Combat and its RNG have already resolved. */
export function createCompanionActionPlayback(
  publish: (cue: CompanionPlaybackCue | null) => void,
  isCurrent: (cue: CompanionActionCue) => boolean,
  impact: (cue: CompanionActionCue) => void = () => {},
) {
  const timers = new TimerGroup();
  let pending: CompanionActionCue[] = [];
  let playing = false;
  let sequence = 0;
  let generation = 0;
  let waiters: Array<() => void> = [];
  function settle() {
    const completed = waiters;
    waiters = [];
    for (const resolve of completed) resolve();
  }
  function next() {
    playing = false;
    let cue = pending.shift();
    while (cue && !isCurrent(cue)) cue = pending.shift();
    if (!cue) {
      publish(null);
      settle();
      return;
    }
    playing = true;
    const current = generation;
    const action = cue;
    timers.setTimeout(
      () => {
        if (current === generation && isCurrent(action)) impact(action);
      },
      shouldReduceMotion() ? 0 : cue.kind === "attack" ? ATTACK_SWING_APEX_MS : CAST_BRACE_APEX_MS,
    );
    // Arm before notifying: teardown can occur inside a synchronous subscriber.
    timers.setTimeout(
      () => {
        if (current === generation) next();
      },
      shouldReduceMotion() ? 160 : cue.kind === "attack" ? ATTACK_LUNGE_DURATION_MS : CAST_BRACE_DURATION_MS,
    );
    publish({ ...cue, sequence: ++sequence });
  }
  return {
    enqueue(cues: readonly CompanionActionCue[]) {
      pending.push(...cues);
      if (!playing && pending.length) next();
    },
    waitForIdle(): Promise<void> {
      return playing || pending.length
        ? new Promise((resolve) => {
            waiters.push(resolve);
          })
        : Promise.resolve();
    },
    clear(notify = true) {
      generation += 1;
      timers.clearAll();
      pending = [];
      playing = false;
      if (notify) publish(null);
      settle();
    },
  };
}

/** Compatibility for hosts that describe a single opening/turn action. */
export function presentCompanionAction(
  presentation: BattlePresentationPort,
  companion: BattleSnapshot["activeCompanion"],
) {
  if (companion)
    presentation.enqueueCompanionActions([
      {
        companionId: companion.id,
        kind: isAttackCard({ effects: companion.turnStartEffects }) ? "attack" : "cast",
      },
    ]);
}
