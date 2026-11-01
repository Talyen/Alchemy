import type { UISound } from "@/lib/audio";
import type { GameSession, SessionFeedback } from "./game-session-types";
import { sessionRuntime } from "./session-runtime";
import { assertSessionOwnership, bindSessionCapabilities } from "./session-capability-graph";
export { assertSessionOwnership, bindSessionCapabilities } from "./session-capability-graph";

const SAVE_GATED_UI_SOUNDS: ReadonlySet<UISound> = new Set([
  "shopBuy",
  "shopRefresh",
  "shopRemove",
  "campfireRest",
  "alchemistMix",
  "talentUnlock",
  "campBrew",
  "craft",
  "bond",
  "salvage",
  "newRun",
  "draftComplete",
]);

const sessionFeedbacks = new WeakMap<GameSession, SessionFeedback>();

export function sessionFeedback(gameSession: GameSession): SessionFeedback {
  const runtime = sessionRuntime(gameSession);
  let feedback = sessionFeedbacks.get(gameSession);
  if (!feedback) {
    const completion = runtime.progressCompletion;
    feedback = bindSessionCapabilities(gameSession, {
      ...runtime.feedback,
      playUISound: (...args: Parameters<typeof runtime.feedback.playUISound>) => {
        if (SAVE_GATED_UI_SOUNDS.has(args[0])) completion.afterSaved(() => runtime.feedback.playUISound(...args));
        else runtime.feedback.playUISound(...args);
      },
      playGoldGain: () => completion.afterSaved(() => runtime.feedback.playGoldGain()),
      playGoldSpend: () => completion.afterSaved(() => runtime.feedback.playGoldSpend()),
      playVictory: () => completion.afterSaved(() => runtime.feedback.playVictory()),
      playRunVictory: () => completion.afterSaved(() => runtime.feedback.playRunVictory()),
      playDefeat: () => completion.afterSaved(() => runtime.feedback.playDefeat()),
    });
    sessionFeedbacks.set(gameSession, feedback);
  }
  return feedback;
}

export function sessionClock(gameSession: GameSession) {
  return sessionRuntime(gameSession).clock;
}

export function registerSessionCleanup(gameSession: GameSession, cleanup: () => void) {
  return sessionRuntime(gameSession).track(cleanup);
}

/** Player entrypoints only; internal turn/settlement commands stay synchronous. */
export function guardProgressAction<Args extends unknown[], Result>(
  gameSession: GameSession,
  action: (...args: Args) => Result,
  blocked: Result,
): (...args: Args) => Result {
  assertSessionOwnership(gameSession, action);
  const guarded = (...args: Args): Result => {
    const runtime = sessionRuntime(gameSession);
    const completion = runtime.progressCompletion;
    if (
      !completion.canStartAction(
        runtime.io.isClearing() || runtime.persistentClearInFlight,
        runtime.io.getSaveWriteFailure(),
      )
    )
      return blocked;
    return action(...args);
  };
  return bindSessionCapabilities(gameSession, guarded);
}

export function afterProgressSaved(gameSession: GameSession, run: () => void) {
  sessionRuntime(gameSession).progressCompletion.afterSaved(run);
}

/** Persistence receives runtime metadata, never a writable gameplay state. */
export function sessionProgressCompletion(gameSession: GameSession) {
  return sessionRuntime(gameSession).progressCompletion;
}

export function readSessionRevision(gameSession: GameSession): number {
  return sessionRuntime(gameSession).gameplay.reads.getState().revision;
}

export function markSessionProgress(gameSession: GameSession, force = false) {
  const runtime = sessionRuntime(gameSession);
  const state = runtime.gameplay.reads.getState();
  runtime.progressCompletion.mark(state.revision, force, state);
}
