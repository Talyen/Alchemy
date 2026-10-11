import type { SaveBackend } from "@/lib/platform-save-backend";
import type { GameSession } from "../stores/game-session-types";
import { sessionRuntime } from "../stores/session-runtime";
import type { UnstampedSaveData } from "./types";

export function getSaveWriteFailure(gameSession: GameSession) {
  return sessionRuntime(gameSession).io.getSaveWriteFailure();
}
export function subscribeSaveWriteFailure(listener: () => void, gameSession: GameSession) {
  const runtime = sessionRuntime(gameSession);
  return runtime.track(runtime.io.subscribeSaveWriteFailure(listener));
}
export function configureSaveBackend(backend: SaveBackend, gameSession: GameSession) {
  const runtime = sessionRuntime(gameSession);
  runtime.io.configureSaveBackend(backend);
  runtime.progressCompletion.cancel();
}
export function setWritesDisabled(disabled: boolean, gameSession: GameSession) {
  const runtime = sessionRuntime(gameSession);
  if (disabled) runtime.progressCompletion.cancel();
  runtime.io.setWritesDisabled(disabled);
}
export function routeWritesToRecovery(gameSession: GameSession) {
  sessionRuntime(gameSession).io.routeWritesToRecovery();
}
export function subscribeSaveCancellation(listener: () => void, gameSession: GameSession) {
  const runtime = sessionRuntime(gameSession);
  return runtime.track(runtime.io.subscribeSaveCancellation(listener));
}
export function waitForPendingSaveWrites(gameSession: GameSession) {
  return sessionRuntime(gameSession).io.waitForPendingSaveWrites();
}
export function loadAlchemySaveState(gameSession: GameSession) {
  return sessionRuntime(gameSession).io.loadAlchemySaveState();
}
export async function saveAlchemySaveData(data: UnstampedSaveData, gameSession: GameSession) {
  const runtime = sessionRuntime(gameSession);
  return runtime.progressCompletion.completeSnapshot(data, await runtime.io.saveAlchemySaveData(data));
}
export async function saveAlchemySaveDataForExit(data: UnstampedSaveData, gameSession: GameSession) {
  const runtime = sessionRuntime(gameSession);
  return runtime.progressCompletion.completeSnapshot(data, await runtime.io.saveAlchemySaveDataForExit(data));
}
export function clearAlchemySaveData(mode: "default" | "localWipe" = "default", gameSession: GameSession) {
  const runtime = sessionRuntime(gameSession);
  runtime.progressCompletion.cancel();
  return runtime.io.clearAlchemySaveData(mode);
}
export function resetStorageIoForTests(gameSession: GameSession) {
  const runtime = sessionRuntime(gameSession);
  runtime.progressCompletion.cancel();
  return runtime.io.resetStorageIoForTests();
}
