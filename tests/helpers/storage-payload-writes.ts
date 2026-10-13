import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { sessionRuntime } from "@/features/alchemy/shared/stores/session-runtime";
import type { UnstampedSaveData } from "@/features/alchemy/shared/storage/types";

// Transport tests exercise arbitrary wire payloads below session provenance.
export function writeStoragePayload(data: UnstampedSaveData, session: GameSession) {
  return sessionRuntime(session).io.saveAlchemySaveData(data);
}

export function writeStoragePayloadOnExit(data: UnstampedSaveData, session: GameSession) {
  return sessionRuntime(session).io.saveAlchemySaveDataForExit(data);
}
