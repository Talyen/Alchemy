import { defaultGameSession } from "@/app/application-session";
import { useEffect, useState } from "react";
import {
  createDefaultSaveData,
  createSessionPersistence,
  type SaveLoadState,
  type SessionPersistence,
} from "@/features/alchemy/shared/storage";
import { logStorageFailure } from "@/lib/storage-logging";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";

async function maybeWipeLocalSaveFromQuery(persistence: SessionPersistence): Promise<void> {
  if (!isAlchemyDevBuild() || typeof window === "undefined") return;
  const url = new URL(window.location.href);
  // Exact `=1` match: a bare flag or `=0` must not wipe. Local-first wipe so
  // a Cloud hiccup cannot leave local progress behind on a dev reset.
  if (url.searchParams.get("wipeLocalSave") !== "1") return;
  const cleared = await persistence.clear("localWipe");
  if (!cleared) return;
  url.searchParams.delete("wipeLocalSave");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next);
}

export function useAlchemyBootstrap(): SaveLoadState | null {
  const [bootstrapResult, setBootstrapResult] = useState<SaveLoadState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const persistence = createSessionPersistence(defaultGameSession);
    void (async () => {
      let result: SaveLoadState;
      // A Steam setup failure must not prevent local loading or normal play.
      try {
        await persistence.configurePlatform();
      } catch (error) {
        logStorageFailure("Save backend setup failed", error);
      }
      if (cancelled) return;
      try {
        // Configure before the dev wipe so desktop resets include Cloud.
        await maybeWipeLocalSaveFromQuery(persistence);
      } catch (error) {
        logStorageFailure("Development save wipe failed", error);
      }
      if (cancelled) return;
      try {
        result = await persistence.load();
      } catch (error) {
        if (cancelled) return;
        logStorageFailure("Save bootstrap failed", error);
        persistence.routeToRecovery();
        result = { data: createDefaultSaveData(), status: { kind: "unavailable" } };
      }
      if (cancelled) return;
      persistence.restore(result.data, { preserveActiveRunIfInitialized: true, restoreActions: result.restoreActions });
      setBootstrapResult(result);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return bootstrapResult;
}
