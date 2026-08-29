import { useEffect, useState } from "react";
import {
  applySaveDataToStores,
  bootstrapAlchemySaveState,
} from "@/features/alchemy/shared/storage/bootstrap-save-state";
import type { SaveLoadState } from "@/features/alchemy/shared/storage";
import { clearAlchemySaveData } from "@/features/alchemy/shared/storage";
import { restoreRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { readRunInitialized } from "@/features/alchemy/shared/stores/run-reads";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";

async function maybeWipeLocalSaveFromQuery(): Promise<void> {
  if (!isAlchemyDevBuild() || typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("wipeLocalSave")) return;
  const cleared = await clearAlchemySaveData();
  if (!cleared) return;
  url.searchParams.delete("wipeLocalSave");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next);
}

export function useAlchemyBootstrap(): SaveLoadState | null {
  const [bootstrapResult, setBootstrapResult] = useState<SaveLoadState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await maybeWipeLocalSaveFromQuery();
      if (cancelled) return;
      const result = await bootstrapAlchemySaveState();
      if (cancelled) return;
      applySaveDataToStores(result.data);
      if (!readRunInitialized()) {
        restoreRun(
          result.data.activeRun,
          result.data.talentXP,
          result.data.unlockedTalents,
          result.data.parkedRuns,
          result.data.runRecency,
        );
      }
      setBootstrapResult(result);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return bootstrapResult;
}
