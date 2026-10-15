import { createSessionLifetime } from "./session-lifetime";
import { SessionSaveSnapshots } from "../storage/session-save-snapshots";
import { ProgressCompletion } from "../storage/progress-completion";
import { createInstanceId } from "@/lib/utils";
import { createSaveIo } from "../storage/save-io";
import type { GameSession, GameSessionOptions, SessionClock, SessionFeedback } from "./game-session-types";
import { createGameplayStore } from "./gameplay-state";
import { generateRandomRunSeed } from "./run-state-init";
import { createSettingsPersistenceCodec, createSettingsStore } from "./settings-state";
import { createRunLifecycleEffects, isolateSessionFeedback } from "./session-effects";

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

function createRuntime(options: GameSessionOptions, allowPlatformStorage: boolean) {
  const lifetime = createSessionLifetime();
  const sourceClock = bindRuntimeMethods(nativeClock, options.runtimeInputs?.clock);
  const clock = lifetime.ownClock(sourceClock);
  const {
    generateRunSeed,
    cosmeticRandom,
    createInstanceId: instanceIdSource,
  } = bindRuntimeMethods(
    { generateRunSeed: generateRandomRunSeed, cosmeticRandom: () => Math.random(), createInstanceId },
    options.runtimeInputs,
  );
  const settings = createSettingsStore(lifetime.isActive);
  const feedback = isolateSessionFeedback(
    bindRuntimeMethods<SessionFeedback>(
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
    ),
  );
  const gameplay = createGameplayStore(generateRunSeed, lifetime.isActive);
  const progressCompletion = new ProgressCompletion(lifetime.isActive);
  const lifecycle = createRunLifecycleEffects(feedback, lifetime.isActive);
  const io = createSaveIo(options.saveBackend, sourceClock.now, allowPlatformStorage, lifetime.isActive);
  // Storage invalidation is a session event, independent of autosave clients.
  lifetime.track(io.subscribeSaveCancellation(() => progressCompletion.cancel()));
  // Restore publication installs both stores before this event, and notifies
  // their observers only after old navigation and playback have been revoked.
  lifetime.track(progressCompletion.subscribeRestore(() => lifecycle.restore()));
  return {
    gameplay,
    presentationBase: gameplay.reads.getState(),
    settings,
    settingsCodec: createSettingsPersistenceCodec(settings),
    io,
    clock,
    generateRunSeed,
    cosmeticRandom,
    createInstanceId: instanceIdSource,
    feedback,
    inCommand: false,
    progressCompletion,
    saveSnapshots: new SessionSaveSnapshots(progressCompletion),
    persistentClearInFlight: false,
    lifecycle,
    track: lifetime.track,
    lifetime,
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
        const failures = runtime.lifetime.close();
        runtime.progressCompletion.cancel();
        runtime.lifecycle.dispose();
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
  if (!runtime || runtime.lifetime.disposed) throw new Error("Game session is disposed or invalid");
  return runtime;
}
