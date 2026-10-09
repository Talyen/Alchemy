import type { GameSession } from "./game-session-types";
import { type GameplayState } from "./gameplay-state-store";
import { createDefaultProfileSaveFields, type ProfileSaveFields } from "./profile-store-types";
import type { RunDomainDataState, RunSessionFields, TRANSIENT_RUN_KEYS } from "./run-domain-types";
import { RUN_PROFILE_SAVE_KEYS } from "./run-profile-codec";
import {
  LABYRINTH_GATED_SESSION_KEYS,
  NON_WILDWOOD_GATED_SESSION_KEY,
  type TRANSIENT_SESSION_KEYS,
  WILDWOOD_GATED_SESSION_KEY,
} from "./run-resume-codec";
import { sessionRuntime } from "./session-runtime";
import { createDefaultSettingsSaveFields, type SettingsSaveFields } from "./settings-store";

// Dirty-tracking for persistence: fires only for persisted inputs. A new run,
// battle, or session field must be classified below before typecheck passes.
// The classifications follow encodeRunResumeSnapshot in run-resume-codec.ts.
export function subscribePersistenceCommits(listener: () => void, gameSession: GameSession): () => void {
  const runtime = sessionRuntime(gameSession);
  const unsubscribeSettings = runtime.settings.subscribe((state, previous) => {
    if (!fieldsEqual(previous, state, SETTINGS_SAVE_KEYS)) listener();
  });
  const unsubscribeGameplay = runtime.gameplay.subscribe((state, previous) => {
    if (!gameplayPersistedInputsEqual(previous, state)) listener();
  });
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

type ClassifiedRunKey = "activeRun" | (typeof TRANSIENT_RUN_KEYS)[number];
type ClassifiedSessionKey =
  | "activity"
  | "rewardFlow"
  | (typeof TRANSIENT_SESSION_KEYS)[number]
  | (typeof LABYRINTH_GATED_SESSION_KEYS)[number]
  | typeof WILDWOOD_GATED_SESSION_KEY
  | typeof NON_WILDWOOD_GATED_SESSION_KEY;
type MissingCombatKey = Exclude<keyof Extract<RunSessionFields["activity"], { kind: "battle" }>["data"], "battleState">;
type MissingRunKey = Exclude<keyof RunDomainDataState, ClassifiedRunKey>;
type MissingSessionKey = Exclude<keyof RunSessionFields, ClassifiedSessionKey>;
const allFieldsClassified: Readonly<{
  combat: MissingCombatKey extends never ? true : never;
  run: MissingRunKey extends never ? true : never;
  session: MissingSessionKey extends never ? true : never;
}> = { combat: true, run: true, session: true };
void allFieldsClassified;

function fieldsEqual<T extends object>(previous: T, next: T, keys: ReadonlyArray<keyof T>): boolean {
  return keys.every((key) => Object.is(previous[key], next[key]));
}

function sessionPersistedInputsEqual(
  previous: GameplayState["session"],
  next: GameplayState["session"],
  previousMode: GameplayState["run"]["activeRun"]["contentSystemType"],
  nextMode: GameplayState["run"]["activeRun"]["contentSystemType"],
): boolean {
  if (previousMode !== nextMode) return false;
  if (previous === next) return true;
  // The reward claim gate is routing-only; the persisted reward payload is
  // state + companionCards while a rewards activity is selected.
  if (
    previous.activity.kind === "rewards" ||
    next.activity.kind === "rewards" ||
    previous.activity.kind === "destination" ||
    next.activity.kind === "destination"
  ) {
    if (!Object.is(previous.rewardFlow.state, next.rewardFlow.state)) return false;
    if (!Object.is(previous.rewardFlow.companionCards, next.rewardFlow.companionCards)) return false;
  }
  if (previous.activity.kind === "battle" && next.activity.kind === "battle") {
    if (!Object.is(previous.activity.data.battleState, next.activity.data.battleState)) return false;
  } else if (!Object.is(previous.activity, next.activity)) return false;
  if (previousMode === "labyrinth" && !fieldsEqual(previous, next, LABYRINTH_GATED_SESSION_KEYS)) return false;
  if (previousMode === "wildwood") {
    return Object.is(previous[WILDWOOD_GATED_SESSION_KEY], next[WILDWOOD_GATED_SESSION_KEY]);
  }
  return Object.is(previous[NON_WILDWOOD_GATED_SESSION_KEY], next[NON_WILDWOOD_GATED_SESSION_KEY]);
}

export function gameplayPersistedInputsEqual(previous: GameplayState, next: GameplayState): boolean {
  if (previous === next) return true;
  if (!fieldsEqual(previous.runProfile, next.runProfile, RUN_PROFILE_SAVE_KEYS)) return false;
  if (!Object.is(previous.gear, next.gear)) return false;
  if (!fieldsEqual(previous.profile, next.profile, PROFILE_SAVE_KEYS)) return false;
  if (!Object.is(previous.run.activeRun, next.run.activeRun)) return false;
  return sessionPersistedInputsEqual(
    previous.session,
    next.session,
    previous.run.activeRun.contentSystemType,
    next.run.activeRun.contentSystemType,
  );
}
