import type { GameSession } from "./game-session-types";
import { sessionRuntime } from "./session-runtime";

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

const capabilityOwners = new WeakMap<object, GameSession>();

/** Fail before composition can connect gameplay from different careers. */
export function assertSessionOwnership(gameSession: GameSession, ...capabilities: object[]): void {
  sessionRuntime(gameSession);
  for (const capability of capabilities) {
    const owner = capabilityOwners.get(capability);
    if (owner && owner !== gameSession) throw new Error("Cannot compose capabilities from different game sessions");
    if (typeof capability === "object" && capability !== null) {
      for (const value of Object.values(capability) as unknown[]) {
        if (typeof value === "function") {
          const methodOwner = capabilityOwners.get(value);
          if (methodOwner && methodOwner !== gameSession)
            throw new Error("Cannot compose capabilities from different game sessions");
        }
      }
    }
  }
}

/** Bind one domain's operations; ownership survives passing an individual method. */
export function bindSessionCapabilities<T extends object>(gameSession: GameSession, capabilities: T): T {
  assertSessionOwnership(gameSession, capabilities);
  const bound = { ...capabilities };
  for (const key of Object.keys(bound) as Array<keyof T>) {
    const method = bound[key];
    if (typeof method !== "function") continue;
    const wrapped = (...args: unknown[]) => {
      sessionRuntime(gameSession);
      return (method as (...args: unknown[]) => unknown)(...args);
    };
    capabilityOwners.set(wrapped, gameSession);
    bound[key] = wrapped as T[keyof T];
  }
  capabilityOwners.set(bound, gameSession);
  return bound;
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
  capabilityOwners.set(guarded, gameSession);
  return guarded;
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
  return sessionRuntime(gameSession).gameplay.getState().revision;
}

export function markSessionProgress(gameSession: GameSession, force = false) {
  const runtime = sessionRuntime(gameSession);
  if (runtime.progressCompletion.read().kind === "idle") runtime.presentationBase = runtime.gameplay.getState();
  runtime.progressCompletion.mark(runtime.gameplay.getState().revision, force);
}
