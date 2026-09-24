import { createDefaultSettingsSaveFields, useSettingsStore, type SettingsSaveFields } from "./settings-store";
import { createDefaultProfileSaveFields, type ProfileSaveFields } from "./profile-store-types";
import {
  LABYRINTH_GATED_SESSION_KEYS,
  NON_WILDWOOD_GATED_SESSION_KEY,
  type TRANSIENT_SESSION_KEYS,
  WILDWOOD_GATED_SESSION_KEY,
} from "./run-resume-codec";
import type {
  TRANSIENT_RUN_KEYS,
  RunDomainBattleState,
  RunDomainDataState,
  RunSessionFields,
} from "./run-domain-types";
import { RUN_PROFILE_SAVE_KEYS } from "./run-profile-codec";
import { useGameplayStateStore, type GameplayState } from "./gameplay-state-store";

// Dirty-tracking for persistence: fires only for persisted inputs. A new run,
// battle, or session field must be classified below before typecheck passes.
// The classifications follow encodeRunResumeSnapshot in run-resume-codec.ts.
export function subscribePersistenceCommits(listener: () => void): () => void {
  const unsubscribeSettings = useSettingsStore.subscribe((state, previous) => {
    if (!settingsPersistedInputsEqual(previous, state)) listener();
  });
  const unsubscribeGameplay = useGameplayStateStore.subscribe((state, previous) => {
    if (!gameplayPersistedInputsEqual(previous, state)) listener();
  });
  return () => {
    unsubscribeSettings();
    unsubscribeGameplay();
  };
}

// Settings save keys derive from the defaults factory (same pattern as
// PROFILE_SAVE_KEYS below), so a future persisted field is compared
// automatically. Transient UI state lives outside this store entirely.
const SETTINGS_SAVE_KEYS = Object.keys(createDefaultSettingsSaveFields()) as Array<keyof SettingsSaveFields>;

function settingsPersistedInputsEqual(previous: SettingsSaveFields, next: SettingsSaveFields): boolean {
  for (const key of SETTINGS_SAVE_KEYS) {
    if (!Object.is(previous[key], next[key])) return false;
  }
  return true;
}

// Profile save keys derive from the defaults factory, so a future persisted
// profile field is compared automatically while collectionTab/collectionPages
// (UI-only, absent from defaults) never dirty.
const PROFILE_SAVE_KEYS = Object.keys(createDefaultProfileSaveFields()) as Array<keyof ProfileSaveFields>;

type ClassifiedRunKey = "activeRun" | (typeof TRANSIENT_RUN_KEYS)[number];
type ClassifiedBattleKey = "battleState" | "hasActiveBattle" | "battleStartState";
type ClassifiedSessionKey =
  | "activity"
  | "rewardFlow"
  | (typeof TRANSIENT_SESSION_KEYS)[number]
  | (typeof LABYRINTH_GATED_SESSION_KEYS)[number]
  | typeof WILDWOOD_GATED_SESSION_KEY
  | typeof NON_WILDWOOD_GATED_SESSION_KEY;
type MissingRunKey = Exclude<keyof RunDomainDataState, ClassifiedRunKey>;
type MissingBattleKey = Exclude<keyof RunDomainBattleState, ClassifiedBattleKey>;
type MissingSessionKey = Exclude<keyof RunSessionFields, ClassifiedSessionKey>;
const allFieldsClassified: Readonly<{
  run: MissingRunKey extends never ? true : never;
  battle: MissingBattleKey extends never ? true : never;
  session: MissingSessionKey extends never ? true : never;
}> = { run: true, battle: true, session: true };
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
  // state + companionCards (see encodeInterruptedFlow).
  if (!Object.is(previous.rewardFlow.state, next.rewardFlow.state)) return false;
  if (!Object.is(previous.rewardFlow.companionCards, next.rewardFlow.companionCards)) return false;
  if (!Object.is(previous.activity, next.activity)) return false;
  if (previousMode === "labyrinth" && !fieldsEqual(previous, next, LABYRINTH_GATED_SESSION_KEYS)) return false;
  if (previousMode === "wildwood") {
    return Object.is(previous[WILDWOOD_GATED_SESSION_KEY], next[WILDWOOD_GATED_SESSION_KEY]);
  }
  return Object.is(previous[NON_WILDWOOD_GATED_SESSION_KEY], next[NON_WILDWOOD_GATED_SESSION_KEY]);
}

function gameplayPersistedInputsEqual(previous: GameplayState, next: GameplayState): boolean {
  if (previous === next) return true;
  if (!fieldsEqual(previous.runProfile, next.runProfile, RUN_PROFILE_SAVE_KEYS)) return false;
  if (!Object.is(previous.gear, next.gear)) return false;
  if (!Object.is(previous.battle.battleState, next.battle.battleState)) return false;
  if (previous.battle.hasActiveBattle !== next.battle.hasActiveBattle) return false;
  for (const key of PROFILE_SAVE_KEYS) {
    if (!Object.is(previous.profile[key], next.profile[key])) return false;
  }
  if (!Object.is(previous.run.activeRun, next.run.activeRun)) return false;
  return sessionPersistedInputsEqual(
    previous.session,
    next.session,
    previous.run.activeRun.contentSystemType,
    next.run.activeRun.contentSystemType,
  );
}
