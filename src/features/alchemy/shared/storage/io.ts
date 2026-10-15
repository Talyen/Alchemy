import type { SaveBackend } from "@/lib/platform-save-backend";
import type { GameSession } from "../stores/game-session-types";
import { sessionRuntime } from "../stores/session-runtime";
import type { UnstampedSaveData } from "./types";
import type { SaveStorageEvent } from "./save-operation-queue";

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
  runtime.saveSnapshots.invalidate();
  runtime.progressCompletion.cancel();
}
export function setWritesDisabled(disabled: boolean, gameSession: GameSession) {
  const runtime = sessionRuntime(gameSession);
  runtime.io.setWritesDisabled(disabled);
}
export function routeWritesToRecovery(gameSession: GameSession) {
  sessionRuntime(gameSession).io.routeWritesToRecovery();
}
export function subscribeSaveEvents(listener: (event: SaveStorageEvent) => void, gameSession: GameSession) {
  const runtime = sessionRuntime(gameSession);
  return runtime.track(runtime.io.subscribeSaveEvents(listener));
}
export function waitForPendingSaveWrites(gameSession: GameSession) {
  return sessionRuntime(gameSession).io.waitForPendingSaveWrites();
}
export function loadAlchemySaveState(gameSession: GameSession) {
  return sessionRuntime(gameSession).io.loadAlchemySaveState();
}
function writeSessionSnapshot(data: UnstampedSaveData, gameSession: GameSession, exit: boolean) {
  const runtime = sessionRuntime(gameSession);
  const admission = runtime.saveSnapshots.prepare(data);
  if (typeof admission === "string") return Promise.resolve(admission);
  return exit
    ? runtime.io.saveAlchemySaveDataForExit(data, admission.complete, admission.validate)
    : runtime.io.saveAlchemySaveData(data, admission.complete, admission.validate);
}
export function saveAlchemySaveData(data: UnstampedSaveData, gameSession: GameSession) {
  return writeSessionSnapshot(data, gameSession, false);
}
export function saveAlchemySaveDataForExit(data: UnstampedSaveData, gameSession: GameSession) {
  return writeSessionSnapshot(data, gameSession, true);
}
export function clearAlchemySaveData(mode: "default" | "localWipe" = "default", gameSession: GameSession) {
  const runtime = sessionRuntime(gameSession);
  return runtime.io.clearAlchemySaveData(mode);
}
export function resetStorageIoForTests(gameSession: GameSession) {
  const runtime = sessionRuntime(gameSession);
  runtime.saveSnapshots.invalidate();
  runtime.progressCompletion.cancel();
  return runtime.io.resetStorageIoForTests();
}
