import type { CharacterId, DifficultyId } from "@/lib/game-data";
import { appendUniqueMany } from "@/lib/utils";
import type { GameSession } from "./game-session-types";
import { readGameplayState } from "./gameplay-state-reads";
import { type GameplayPersistenceCodec } from "./persistence-codec";
import { createDefaultProfileSaveFields, type ProfileSaveFields, type ProfileStateFields } from "./profile-store-types";
import type { RunTransaction } from "./run-session-command";
import {
  setDiscoveredCardIds as setDiscoveredCardIdsInDraft,
  setDiscoveredTrinketIds as setDiscoveredTrinketIdsInDraft,
  setDiscoveredUniqueIds as setDiscoveredUniqueIdsInDraft,
} from "./run-session-write-port";

export type { ProfileSaveFields } from "./profile-store-types";

function cloneProfileSaveFields(fields: ProfileSaveFields): ProfileSaveFields {
  return {
    collectedBoardIds: [...fields.collectedBoardIds],
    boardSelection: { ...fields.boardSelection },
    activeBoardId: fields.activeBoardId,
    lastRandomBoardId: fields.lastRandomBoardId,
    pendingBoardRewardId: fields.pendingBoardRewardId,
    discoveredCardIds: [...fields.discoveredCardIds],
    encounteredEnemyIds: [...fields.encounteredEnemyIds],
    discoveredTrinketIds: [...fields.discoveredTrinketIds],
    discoveredUniqueIds: [...fields.discoveredUniqueIds],
    completedDifficulties: Object.fromEntries(
      Object.entries(fields.completedDifficulties).map(([characterId, difficulties]) => [
        characterId,
        [...difficulties],
      ]),
    ) as Record<CharacterId, DifficultyId[]>,
    finishedRunCharacters: [...fields.finishedRunCharacters],
  };
}

export const profilePersistenceCodec: GameplayPersistenceCodec<ProfileSaveFields> = {
  createDefault: createDefaultProfileSaveFields,
  encode: (gameSession: GameSession) => cloneProfileSaveFields(readGameplayState(gameSession).profile),
  hydrate: (fields, draft) => Object.assign(draft.profile, cloneProfileSaveFields(fields)),
};

export type ProfileReadView = Pick<
  ProfileStateFields,
  | "collectedBoardIds"
  | "boardSelection"
  | "activeBoardId"
  | "lastRandomBoardId"
  | "pendingBoardRewardId"
  | "collectionTab"
  | "collectionPages"
  | "discoveredCardIds"
  | "encounteredEnemyIds"
  | "discoveredTrinketIds"
  | "discoveredUniqueIds"
  | "completedDifficulties"
  | "finishedRunCharacters"
>;

export function readProfileStore(gameSession: GameSession): ProfileReadView {
  // Live references: arrays/objects below alias the committed aggregate (the
  // codec clones on encode). Never mutate the result outside a
  // dispatchRunSessionCommand draft.
  const profile = readGameplayState(gameSession).profile;
  return {
    collectedBoardIds: profile.collectedBoardIds,
    boardSelection: profile.boardSelection,
    activeBoardId: profile.activeBoardId,
    lastRandomBoardId: profile.lastRandomBoardId,
    pendingBoardRewardId: profile.pendingBoardRewardId,
    collectionTab: profile.collectionTab,
    collectionPages: profile.collectionPages,
    discoveredCardIds: profile.discoveredCardIds,
    encounteredEnemyIds: profile.encounteredEnemyIds,
    discoveredTrinketIds: profile.discoveredTrinketIds,
    discoveredUniqueIds: profile.discoveredUniqueIds,
    completedDifficulties: profile.completedDifficulties,
    finishedRunCharacters: profile.finishedRunCharacters,
  };
}

export function discoverCardIds(draft: RunTransaction, ids: readonly string[]): void {
  if (ids.length === 0) return;
  setDiscoveredCardIdsInDraft(draft, (current) => appendUniqueMany(current, ids));
}

export function discoverTrinketIds(draft: RunTransaction, ids: readonly string[]): void {
  if (ids.length === 0) return;
  setDiscoveredTrinketIdsInDraft(draft, (current) => appendUniqueMany(current, ids));
}

export function discoverUniqueIds(draft: RunTransaction, ids: readonly string[]): void {
  if (ids.length === 0) return;
  setDiscoveredUniqueIdsInDraft(draft, (current) => appendUniqueMany(current, ids));
}
