import type { CharacterId, DifficultyId } from "@/lib/game-data";
import { appendUniqueMany } from "@/lib/utils";
import { useShallow } from "zustand/react/shallow";
import type { PersistenceCodec } from "./persistence-codec";
import { createDefaultProfileSaveFields, type ProfileSaveFields, type ProfileStateFields } from "./profile-store-types";
import type { GameplayDraft } from "./run-session-command";
import { readGameplayState, subscribeGameplayCommits, useGameplayStateStore } from "./gameplay-state-store";
import {
  setCompletedDifficulties as setCompletedDifficultiesInDraft,
  setDiscoveredCardIds as setDiscoveredCardIdsInDraft,
  setDiscoveredTrinketIds as setDiscoveredTrinketIdsInDraft,
  setEncounteredEnemyIds as setEncounteredEnemyIdsInDraft,
  setFinishedRunCharacters as setFinishedRunCharactersInDraft,
} from "./write-port-profile";

export type { ProfileSaveFields } from "./profile-store-types";

function cloneProfileSaveFields(fields: ProfileSaveFields): ProfileSaveFields {
  return {
    discoveredCardIds: [...fields.discoveredCardIds],
    encounteredEnemyIds: [...fields.encounteredEnemyIds],
    discoveredTrinketIds: [...fields.discoveredTrinketIds],
    completedDifficulties: Object.fromEntries(
      Object.entries(fields.completedDifficulties).map(([characterId, difficulties]) => [
        characterId,
        [...difficulties],
      ]),
    ) as Record<CharacterId, DifficultyId[]>,
    finishedRunCharacters: [...fields.finishedRunCharacters],
  };
}

export const profilePersistenceCodec: PersistenceCodec<ProfileSaveFields, [draft: GameplayDraft]> = {
  createDefault: createDefaultProfileSaveFields,
  encode: () => cloneProfileSaveFields(readGameplayState().profile),
  hydrate: (fields, draft) => Object.assign(draft.profile, cloneProfileSaveFields(fields)),
  subscribe: (listener) => subscribeGameplayCommits(() => listener()),
};

/** Feature-facing read view — data only, no Zustand hook surface. */
export type ProfileReadView = Pick<
  ProfileStateFields,
  | "collectionTab"
  | "collectionPages"
  | "discoveredCardIds"
  | "encounteredEnemyIds"
  | "discoveredTrinketIds"
  | "completedDifficulties"
  | "finishedRunCharacters"
>;

export function readProfileStore(): ProfileReadView {
  const profile = readGameplayState().profile;
  return {
    collectionTab: profile.collectionTab,
    collectionPages: profile.collectionPages,
    discoveredCardIds: profile.discoveredCardIds,
    encounteredEnemyIds: profile.encounteredEnemyIds,
    discoveredTrinketIds: profile.discoveredTrinketIds,
    completedDifficulties: profile.completedDifficulties,
    finishedRunCharacters: profile.finishedRunCharacters,
  };
}

export function useProfileDiscoverySlice() {
  return useGameplayStateStore(
    useShallow((state) => ({
      discoveredCardIds: state.profile.discoveredCardIds,
      encounteredEnemyIds: state.profile.encounteredEnemyIds,
      discoveredTrinketIds: state.profile.discoveredTrinketIds,
    })),
  );
}

export function useProfileCollectionSlice() {
  return useGameplayStateStore(
    useShallow((state) => ({
      collectionTab: state.profile.collectionTab,
      discoveredCardIds: state.profile.discoveredCardIds,
      encounteredEnemyIds: state.profile.encounteredEnemyIds,
      discoveredTrinketIds: state.profile.discoveredTrinketIds,
      collectionPages: state.profile.collectionPages,
    })),
  );
}

export function useFinishedRunCharacters() {
  return useGameplayStateStore((state) => state.profile.finishedRunCharacters);
}

export function useCompletedDifficulties() {
  return useGameplayStateStore((state) => state.profile.completedDifficulties);
}

export function discoverCardIds(draft: GameplayDraft, ids: readonly string[]): void {
  if (ids.length === 0) return;
  setDiscoveredCardIdsInDraft(draft, (current) => appendUniqueMany(current, ids));
}

export function discoverTrinketIds(draft: GameplayDraft, ids: readonly string[]): void {
  if (ids.length === 0) return;
  setDiscoveredTrinketIdsInDraft(draft, (current) => appendUniqueMany(current, ids));
}

export const setEncounteredEnemyIds = setEncounteredEnemyIdsInDraft;
export const setCompletedDifficulties = setCompletedDifficultiesInDraft;
export const setFinishedRunCharacters = setFinishedRunCharactersInDraft;
