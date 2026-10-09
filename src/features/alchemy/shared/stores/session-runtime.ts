import { ProgressCompletion } from "../storage/progress-completion";
import { createInstanceId } from "@/lib/utils";
import { createSaveIo } from "../storage/save-io";
import type { GameSession, GameSessionOptions, SessionClock, SessionFeedback } from "./game-session-types";
import { createGameplayStore } from "./gameplay-state";
import { generateRandomRunSeed } from "./run-state-init";
import { createSettingsPersistenceCodec, createSettingsStore } from "./settings-state";

const nativeClock: SessionClock = {
  now: () => Date.now(),
  setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimeout: (timer) => globalThis.clearTimeout(timer),
};

/** Capture declared methods while preserving prototype providers and their receiver. */
function bindRuntimeMethods<T extends object>(defaults: T, source?: Partial<T>): T {
  const bound = { ...defaults };
  if (!source) return bound;
  for (const key of Object.keys(defaults) as Array<keyof T>) {
    const method = source[key];
    if (typeof method === "function") bound[key] = method.bind(source) as T[keyof T];
  }
  return bound;
}

function createLifecycleChannel() {
  const listeners = new Set<() => void>();
  return {
    on(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit() {
      for (const listener of listeners) listener();
    },
    clear() {
      listeners.clear();
    },
  };
}

function createRuntime(options: GameSessionOptions, allowPlatformStorage: boolean) {
  const clock = bindRuntimeMethods(nativeClock, options.runtimeInputs?.clock);
  const { generateRunSeed, createInstanceId: instanceIdSource } = bindRuntimeMethods(
    { generateRunSeed: generateRandomRunSeed, createInstanceId },
    options.runtimeInputs,
  );
  const cleanups = new Set<() => void>();
  const settings = createSettingsStore();
  const feedback = bindRuntimeMethods<SessionFeedback>(
    {
      playUISound: () => {},
      playGoldGain: () => {},
      playGoldSpend: () => {},
      playVictory: () => {},
      playRunVictory: () => {},
      playDefeat: () => {},
      stopAllSfx: () => {},
      clearCardHover: () => {},
      clearBattleUi: () => {},
      clearSaveConfirmation: () => {},
      resetTransientUi: () => {},
    },
    options.feedback,
  );
  const gameplay = createGameplayStore(generateRunSeed);
  return {
    gameplay,
    presentationBase: gameplay.getState(),
    settings,
    settingsCodec: createSettingsPersistenceCodec(settings),
    io: createSaveIo(options.saveBackend, clock.now, allowPlatformStorage),
    clock,
    generateRunSeed,
    createInstanceId: instanceIdSource,
    feedback,
    inCommand: false,
    progressCompletion: new ProgressCompletion(),
    persistentClearInFlight: false,
    disposed: false,
    teardown: createLifecycleChannel(),
    clearPresentation: createLifecycleChannel(),
    track(cleanup: () => void): () => void {
      cleanups.add(cleanup);
      return () => {
        if (cleanups.delete(cleanup)) cleanup();
      };
    },
    cleanup() {
      const failures: unknown[] = [];
      for (const cleanup of [...cleanups]) {
        cleanups.delete(cleanup);
        try {
          cleanup();
        } catch (error) {
          failures.push(error);
        }
      }
      return failures;
    },
  };
}

export type SessionRuntime = ReturnType<typeof createRuntime>;
const runtimes = new WeakMap<GameSession, SessionRuntime>();

export function createSessionRuntime(options: GameSessionOptions = {}, allowPlatformStorage = false): GameSession {
  const runtime = createRuntime(options, allowPlatformStorage);
  let disposal: Promise<void> | undefined;
  const session = {
    dispose() {
      disposal ??= (async () => {
        runtime.progressCompletion.cancel();
        runtime.disposed = true;
        const failures = runtime.cleanup();
        runtime.teardown.clear();
        runtime.clearPresentation.clear();
        try {
          await runtime.io.waitForPendingSaveWrites();
        } finally {
          runtime.io.setWritesDisabled(true);
        }
        if (failures.length) throw new AggregateError(failures, "Game session cleanup failed");
      })();
      return disposal;
    },
  } as GameSession;
  runtimes.set(session, runtime);
  return session;
}

export function sessionRuntime(session: GameSession): SessionRuntime {
  const runtime = runtimes.get(session);
  if (!runtime || runtime.disposed) throw new Error("Game session is disposed or invalid");
  return runtime;
}
