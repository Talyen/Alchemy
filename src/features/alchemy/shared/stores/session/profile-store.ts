import { appendUniqueMany } from "@/lib/utils";
import type { GameSession } from "./game-session-types";
import { readGameplayState } from "./gameplay-state-reads";
import type { ProfileStateFields } from "./profile-store-types";
import type { RunTransaction } from "../commands/run-session-command";
import {
  setDiscoveredCardIds as setDiscoveredCardIdsInDraft,
  setDiscoveredTrinketIds as setDiscoveredTrinketIdsInDraft,
  setDiscoveredUniqueIds as setDiscoveredUniqueIdsInDraft,
} from "../commands/run-session-write-port";

export type { ProfileSaveFields } from "./profile-store-types";

export type ProfileReadView = Readonly<ProfileStateFields>;

export function readProfileStore(gameSession: GameSession): ProfileReadView {
  return readGameplayState(gameSession).profile;
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
