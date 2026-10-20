import {
  createDefaultSaveData,
  createSessionPersistence,
  type SaveLoadState,
  type SessionPersistence,
} from "@/features/alchemy/shared/storage";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { registerSessionCleanup } from "@/features/alchemy/shared/stores/session-capabilities";
import { logStorageFailure } from "@/lib/storage-logging";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";

async function maybeWipeLocalSaveFromQuery(persistence: SessionPersistence, isActive: () => boolean): Promise<void> {
  if (!isAlchemyDevBuild() || typeof window === "undefined") return;
  const url = new URL(window.location.href);
  // Exact `=1` match: a bare flag or `=0` must not wipe. Local-first wipe so
  // a Cloud hiccup cannot leave local progress behind on a dev reset.
  if (url.searchParams.get("wipeLocalSave") !== "1") return;
  const cleared = await persistence.clear("localWipe");
  if (!cleared || !isActive()) return;
  url.searchParams.delete("wipeLocalSave");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next);
}

const bootstraps = new WeakMap<GameSession, Promise<SaveLoadState | null>>();

/** Bootstrap belongs to the career, so React remounts cannot replay restore or a dev wipe. */
export function bootstrapAlchemySession(gameSession: GameSession): Promise<SaveLoadState | null> {
  const persistence = createSessionPersistence(gameSession);
  const existing = bootstraps.get(gameSession);
  if (existing) return existing;
  let active = true;
  registerSessionCleanup(gameSession, () => {
    active = false;
  });
  // Defer execution until the owner is recorded, including reentrant adapters.
  const result = Promise.resolve().then(async () => {
    if (!active) return null;
    try {
      await persistence.configurePlatform();
    } catch (error) {
      if (active) logStorageFailure("Save backend setup failed", error);
    }
    if (!active) return null;
    try {
      await maybeWipeLocalSaveFromQuery(persistence, () => active);
    } catch (error) {
      if (active) logStorageFailure("Development save wipe failed", error);
    }
    if (!active) return null;
    let loaded: SaveLoadState;
    try {
      loaded = await persistence.load();
    } catch (error) {
      if (!active) return null;
      logStorageFailure("Save bootstrap failed", error);
      persistence.routeToRecovery();
      loaded = { data: createDefaultSaveData(), status: { kind: "unavailable" } };
    }
    if (!active) return null;
    persistence.restore(loaded.data, {
      preserveActiveRunIfInitialized: true,
      startAtMenu: true,
      restoreActions: loaded.restoreActions,
    });
    return active ? loaded : null;
  });
  bootstraps.set(gameSession, result);
  return result;
}
