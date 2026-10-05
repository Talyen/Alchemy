import type { SaveBackend } from "@/lib/platform-save-backend";
import { defaultGameSession } from "../stores/default-game-session";
import type { GameSession } from "../stores/game-session-types";
import { sessionRuntime } from "../stores/session-runtime";
import type { UnstampedSaveData } from "./types";
export { serializeSaveSnapshot } from "./save-storage";

export function getSaveWriteFailure(gameSession: GameSession = defaultGameSession) {
  return sessionRuntime(gameSession).io.getSaveWriteFailure();
}
export function subscribeSaveWriteFailure(listener: () => void, gameSession: GameSession = defaultGameSession) {
  const runtime = sessionRuntime(gameSession);
  return runtime.track(runtime.io.subscribeSaveWriteFailure(listener));
}
export function configureSaveBackend(backend: SaveBackend, gameSession: GameSession = defaultGameSession) {
  sessionRuntime(gameSession).io.configureSaveBackend(backend);
}
export function setWritesDisabled(disabled: boolean, gameSession: GameSession = defaultGameSession) {
  sessionRuntime(gameSession).io.setWritesDisabled(disabled);
}
export function routeWritesToRecovery(gameSession: GameSession = defaultGameSession) {
  sessionRuntime(gameSession).io.routeWritesToRecovery();
}
export function subscribeSaveCancellation(listener: () => void, gameSession: GameSession = defaultGameSession) {
  const runtime = sessionRuntime(gameSession);
  return runtime.track(runtime.io.subscribeSaveCancellation(listener));
}
export function waitForPendingSaveWrites(gameSession: GameSession = defaultGameSession) {
  return sessionRuntime(gameSession).io.waitForPendingSaveWrites();
}
export function loadAlchemySaveState(gameSession: GameSession = defaultGameSession) {
  return sessionRuntime(gameSession).io.loadAlchemySaveState();
}
export function saveAlchemySaveData(data: UnstampedSaveData, gameSession: GameSession = defaultGameSession) {
  return sessionRuntime(gameSession).io.saveAlchemySaveData(data);
}
export function saveAlchemySaveDataForExit(data: UnstampedSaveData, gameSession: GameSession = defaultGameSession) {
  return sessionRuntime(gameSession).io.saveAlchemySaveDataForExit(data);
}
export function clearAlchemySaveData(
  mode: "default" | "localWipe" = "default",
  gameSession: GameSession = defaultGameSession,
) {
  return sessionRuntime(gameSession).io.clearAlchemySaveData(mode);
}
export function resetStorageIoForTests(gameSession: GameSession = defaultGameSession) {
  return sessionRuntime(gameSession).io.resetStorageIoForTests();
}
