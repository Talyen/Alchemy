import { useEffect, useState } from "react";
import {
  buildAlchemySaveDataFromStores,
  configureAlchemySaveBackend,
  createDefaultSaveData,
  hydrateAlchemyPersistenceFields,
  saveAlchemySaveData,
  routeWritesToRecovery,
} from "@/features/alchemy/shared/storage";
import type { SaveLoadState } from "@/features/alchemy/shared/storage";
import { clearAlchemySaveData, loadAlchemySaveState } from "@/features/alchemy/shared/storage";
import { logStorageFailure } from "@/lib/storage-logging";
import { resolveActiveRunForSave, restoreRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { readHasActiveRun, readRunInitialized } from "@/features/alchemy/shared/stores/run-reads";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";

async function maybeWipeLocalSaveFromQuery(): Promise<void> {
  if (!isAlchemyDevBuild() || typeof window === "undefined") return;
  const url = new URL(window.location.href);
  // Exact `=1` match: a bare flag or `=0` must not wipe. Local-first wipe so
  // a Cloud hiccup cannot leave local progress behind on a dev reset.
  if (url.searchParams.get("wipeLocalSave") !== "1") return;
  const cleared = await clearAlchemySaveData("localWipe");
  if (!cleared) return;
  url.searchParams.delete("wipeLocalSave");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next);
}

function needsRestoredBattlePersistence(
  activeRun: Awaited<ReturnType<typeof loadAlchemySaveState>>["data"]["activeRun"],
): boolean {
  const activeCombat = activeRun?.activeCombat;
  return Boolean(activeCombat?.pendingBattleTransition ?? activeCombat?.battleState.turnPhase === "enemy");
}

export function useAlchemyBootstrap(): SaveLoadState | null {
  const [bootstrapResult, setBootstrapResult] = useState<SaveLoadState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let result: SaveLoadState;
      // A Steam setup failure must not prevent local loading or normal play.
      try {
        await configureAlchemySaveBackend();
      } catch (error) {
        logStorageFailure("Save backend setup failed", error);
      }
      if (cancelled) return;
      try {
        // Configure before the dev wipe so desktop resets include Cloud.
        await maybeWipeLocalSaveFromQuery();
      } catch (error) {
        logStorageFailure("Development save wipe failed", error);
      }
      if (cancelled) return;
      try {
        result = await loadAlchemySaveState();
      } catch (error) {
        if (cancelled) return;
        logStorageFailure("Save bootstrap failed", error);
        routeWritesToRecovery();
        result = { data: createDefaultSaveData(), status: { kind: "unavailable" } };
      }
      if (cancelled) return;
      hydrateAlchemyPersistenceFields(result.data);
      if (!readRunInitialized()) {
        restoreRun(result.data.activeRun, result.data.talentXP, result.data.unlockedTalents);
        if (needsRestoredBattlePersistence(result.data.activeRun)) {
          const outcome = await saveAlchemySaveData(
            buildAlchemySaveDataFromStores(resolveActiveRunForSave(readHasActiveRun())),
          );
          if (outcome === "failed") logStorageFailure("Restored battle transition could not be persisted");
        }
      }
      setBootstrapResult(result);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return bootstrapResult;
}
