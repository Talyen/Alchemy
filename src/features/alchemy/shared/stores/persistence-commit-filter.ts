import { createDefaultSettingsSaveFields, useSettingsStore, type SettingsSaveFields } from "./settings-store";
import { createDefaultProfileSaveFields, type ProfileSaveFields } from "./profile-store-types";
import {
  LABYRINTH_GATED_SESSION_KEYS,
  NON_WILDWOOD_GATED_SESSION_KEY,
  TRANSIENT_SESSION_KEYS,
  WILDWOOD_GATED_SESSION_KEY,
} from "./run-resume-codec";
import { TRANSIENT_RUN_KEYS, type RunSessionFields } from "./run-domain-types";
import { useGameplayStateStore, type GameplayState } from "./gameplay-state-store";

// Dirty-tracking for persistence: fires only for persisted inputs. Collection
// browsing, navigation, and other transient commits must not schedule full
// snapshot builds that would encode to identical bytes. Skip-lists stay narrow
// and every other key dirties by default, so a future persisted field cannot
// be missed (its owners are encodeRunResumeSnapshot in run-resume-codec.ts
// plus the persistence codecs in storage/persistence.ts).
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

// Session fields that never reach a snapshot: node/character selections,
// run-end award staging, and the reward claim gate (routing only).
// Single-sourced from the resume codec's persistence contract (see
// TRANSIENT_SESSION_KEYS in run-resume-codec.ts); the claim gate is
// routing-only while its payload (state + companionCards) is compared above.
const TRANSIENT_SESSION_SKIP: ReadonlySet<keyof RunSessionFields> = new Set([...TRANSIENT_SESSION_KEYS, "rewardFlow"]);

// Mode-gated session fields are nulled by the resume codec when their mode is
// inactive (see encodeActiveRunFromSession in run-resume-codec.ts): labyrinth
// fields persist only for labyrinth runs, wildwoodDraft only for wildwood,
// and starterDraftChoices for everything except wildwood. While both snapshots
// sit in the same mode, changes to an inactive mode's fields cannot reach a
// save, so they must not schedule snapshot builds either.
const LABYRINTH_SESSION_SKIP: ReadonlySet<string> = new Set(LABYRINTH_GATED_SESSION_KEYS);

// Run-domain keys that never reach a snapshot: the committed screen (resume
// derives its screen from run activity) and the boot flag.
const TRANSIENT_RUN_SKIP: ReadonlySet<string> = new Set(TRANSIENT_RUN_KEYS);

function recordsEqualExcept(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
  skipped: ReadonlySet<string>,
): boolean {
  if (previous === next) return true;
  for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    if (skipped.has(key)) continue;
    if (!Object.is(previous[key], next[key])) return false;
  }
  return true;
}

function sessionPersistedInputsEqual(
  previous: GameplayState["session"],
  next: GameplayState["session"],
  previousMode: GameplayState["run"]["activeRun"]["contentSystemType"],
  nextMode: GameplayState["run"]["activeRun"]["contentSystemType"],
): boolean {
  if (previous === next) return true;
  // The reward claim gate is routing-only; the persisted reward payload is
  // state + companionCards (see encodeInterruptedFlow).
  if (!Object.is(previous.rewardFlow.state, next.rewardFlow.state)) return false;
  if (!Object.is(previous.rewardFlow.companionCards, next.rewardFlow.companionCards)) return false;
  const skipped = new Set<string>(TRANSIENT_SESSION_SKIP);
  // Skip mode-gated fields only while both snapshots sit in the same mode, so
  // a mode switch itself always dirties. Conservative by construction: the
  // codec nulls exactly these fields for the inactive mode.
  if (previousMode === nextMode) {
    if (previousMode !== "labyrinth") {
      for (const key of LABYRINTH_SESSION_SKIP) skipped.add(key);
    }
    if (previousMode !== "wildwood") skipped.add(WILDWOOD_GATED_SESSION_KEY);
    else skipped.add(NON_WILDWOOD_GATED_SESSION_KEY);
  }
  return recordsEqualExcept(
    previous as unknown as Record<string, unknown>,
    next as unknown as Record<string, unknown>,
    skipped,
  );
}

function gameplayPersistedInputsEqual(previous: GameplayState, next: GameplayState): boolean {
  if (previous === next) return true;
  if (!Object.is(previous.runProfile, next.runProfile)) return false;
  if (!Object.is(previous.gear, next.gear)) return false;
  if (!Object.is(previous.battle, next.battle)) return false;
  for (const key of PROFILE_SAVE_KEYS) {
    if (!Object.is(previous.profile[key], next.profile[key])) return false;
  }
  if (
    !recordsEqualExcept(
      previous.run as unknown as Record<string, unknown>,
      next.run as unknown as Record<string, unknown>,
      TRANSIENT_RUN_SKIP,
    )
  ) {
    return false;
  }
  return sessionPersistedInputsEqual(
    previous.session,
    next.session,
    previous.run.activeRun.contentSystemType,
    next.run.activeRun.contentSystemType,
  );
}
