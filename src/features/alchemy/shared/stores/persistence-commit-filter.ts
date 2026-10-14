import type { GameSession } from "./game-session-types";
import { type GameplayState } from "./gameplay-state-reads";
import { createDefaultProfileSaveFields, type ProfileSaveFields } from "./profile-store-types";
import { RUN_PROFILE_SAVE_KEYS } from "./run-profile-save-fields";
import { projectRunResumeSnapshot } from "./run-resume-codec";
import { sessionRuntime } from "./session-runtime";
import { createDefaultSettingsSaveFields, type SettingsSaveFields } from "./settings-state";

// Both autosave and the progress gate use the resume codec's projection.
// Adding a saved field there also makes it participate in change detection.
export function subscribePersistenceCommits(listener: () => void, gameSession: GameSession): () => void {
  const runtime = sessionRuntime(gameSession);
  let previousGameplay = runtime.gameplay.reads.getState();
  let previousSettings = runtime.settings.getState();
  let previousRestore = runtime.progressCompletion.readRestoreVersion();
  const notify = () => {
    const gameplay = runtime.gameplay.reads.getState();
    const settings = runtime.settings.getState();
    const restored = runtime.progressCompletion.readRestoreVersion();
    const changed =
      previousRestore !== restored ||
      !gameplayPersistedInputsEqual(previousGameplay, gameplay) ||
      !fieldsEqual(previousSettings, settings, SETTINGS_SAVE_KEYS);
    // A restore installs both owners before either notification. Advance both
    // baselines first so their notifications emit one complete save snapshot.
    previousGameplay = gameplay;
    previousSettings = settings;
    previousRestore = restored;
    if (changed) listener();
  };
  const unsubscribeSettings = runtime.settings.subscribe(notify);
  const unsubscribeGameplay = runtime.gameplay.reads.subscribe(notify);
  return runtime.track(() => {
    unsubscribeSettings();
    unsubscribeGameplay();
  });
}

// Settings save keys derive from the defaults factory (same pattern as
// PROFILE_SAVE_KEYS below), so a future persisted field is compared
// automatically. Transient UI state lives outside this store entirely.
const SETTINGS_SAVE_KEYS = Object.keys(createDefaultSettingsSaveFields()) as Array<keyof SettingsSaveFields>;

// Profile save keys derive from the defaults factory, so a future persisted
// profile field is compared automatically while collectionTab/collectionPages
// (UI-only, absent from defaults) never dirty.
const PROFILE_SAVE_KEYS = Object.keys(createDefaultProfileSaveFields()) as Array<keyof ProfileSaveFields>;

function fieldsEqual<T extends object>(previous: T, next: T, keys: ReadonlyArray<keyof T>): boolean {
  return keys.every((key) => Object.is(previous[key], next[key]));
}

// Projections are acyclic save data. Identity skips borrowed immutable branches;
// structural comparison handles derived wire objects and ID arrays without JSON
// serialization or a second field/activity classification.
function saveValuesEqual(previous: unknown, next: unknown): boolean {
  if (Object.is(previous, next)) return true;
  if (previous === null || next === null || typeof previous !== "object" || typeof next !== "object") return false;
  if (Array.isArray(previous) !== Array.isArray(next)) return false;
  const keys = Object.keys(previous);
  if (keys.length !== Object.keys(next).length) return false;
  return keys.every(
    (key) => Object.hasOwn(next, key) && saveValuesEqual(Reflect.get(previous, key), Reflect.get(next, key)),
  );
}

export function gameplayPersistedInputsEqual(previous: GameplayState, next: GameplayState): boolean {
  if (previous === next) return true;
  if (!fieldsEqual(previous.runProfile, next.runProfile, RUN_PROFILE_SAVE_KEYS)) return false;
  if (!Object.is(previous.gear, next.gear)) return false;
  if (!fieldsEqual(previous.profile, next.profile, PROFILE_SAVE_KEYS)) return false;
  if (previous.run.activeRun === next.run.activeRun && previous.session === next.session) return true;
  return saveValuesEqual(
    projectRunResumeSnapshot({ run: previous.run.activeRun, session: previous.session }),
    projectRunResumeSnapshot({ run: next.run.activeRun, session: next.session }),
  );
}
