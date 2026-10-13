import type { GameSession } from "./game-session-types";
import { sessionRuntime } from "./session-runtime";
import { assertSessionOwnership, bindSessionCapabilities } from "./session-capability-graph";
export { assertSessionOwnership, bindSessionCapabilities } from "./session-capability-graph";

export function sessionFeedback(gameSession: GameSession) {
  const runtime = sessionRuntime(gameSession);
  const completion = runtime.progressCompletion;
  if (!completion.active && completion.read().kind === "idle") return runtime.feedback;
  return {
    ...runtime.feedback,
    playUISound: (...args: Parameters<typeof runtime.feedback.playUISound>) => {
      if (
        [
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
        ].includes(args[0])
      )
        completion.afterSaved(() => runtime.feedback.playUISound(...args));
      else runtime.feedback.playUISound(...args);
    },
    playGoldGain: () => completion.afterSaved(() => runtime.feedback.playGoldGain()),
    playGoldSpend: () => completion.afterSaved(() => runtime.feedback.playGoldSpend()),
    playVictory: () => completion.afterSaved(() => runtime.feedback.playVictory()),
    playRunVictory: () => completion.afterSaved(() => runtime.feedback.playRunVictory()),
    playDefeat: () => completion.afterSaved(() => runtime.feedback.playDefeat()),
  };
}

export function sessionClock(gameSession: GameSession) {
  return sessionRuntime(gameSession).clock;
}

export function registerSessionCleanup(gameSession: GameSession, cleanup: () => void): () => void {
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
      (completion.active || completion.read().kind !== "idle") &&
      (completion.read().kind !== "idle" || runtime.io.getSaveWriteFailure() || runtime.persistentClearInFlight)
    )
      return blocked;
    return action(...args);
  };
  return bindSessionCapabilities(gameSession, guarded);
}

export function afterProgressSaved(gameSession: GameSession, run: () => void) {
  const completion = sessionRuntime(gameSession).progressCompletion;
  if (completion.active || completion.read().kind !== "idle") completion.afterSaved(run);
  else run();
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
  if (runtime.progressCompletion.read().kind === "idle") runtime.presentationBase = runtime.gameplay.reads.getState();
  runtime.progressCompletion.mark(runtime.gameplay.reads.getState().revision, force);
}
