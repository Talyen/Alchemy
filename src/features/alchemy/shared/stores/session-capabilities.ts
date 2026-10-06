import type { GameSession } from "./game-session-types";
import { sessionRuntime } from "./session-runtime";

export function sessionFeedback(gameSession: GameSession) {
  return sessionRuntime(gameSession).feedback;
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
