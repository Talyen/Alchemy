import { useEffect } from "react";
import { readHasActiveRun, readRunPhase } from "@/features/alchemy/shared/stores/run-reads";
import { resolveActiveRunForSave } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { useLatestRef } from "@/features/alchemy/shared/hooks";
import {
  buildAlchemySaveDataFromStores,
  saveAlchemySaveData,
  saveAlchemySaveDataForExit,
  subscribeAlchemyPersistence,
} from "@/features/alchemy/shared/storage";
import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import { AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_MAX_WAIT_MS, BATTLE_AUTOSAVE_DEBOUNCE_MS } from "@/lib/game-constants";
import type { Screen } from "@/lib/routing";

export function useAlchemyAutosaveFromStores(enabled = true, runScreenOverride: Screen | null = null) {
  const enabledRef = useLatestRef(enabled);
  const runScreenOverrideRef = useLatestRef(runScreenOverride);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let isDirty = false;
    let dirtySince = 0;

    const dropPending = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      isDirty = false;
      dirtySince = 0;
    };

    const flush = (terminal = false) => {
      if (!enabledRef.current) {
        dropPending();
        return;
      }
      if (!isDirty) return;

      dropPending();

      const activeRun = resolveActiveRunForSave(readHasActiveRun(), runScreenOverrideRef.current ?? undefined);

      const save = buildAlchemySaveDataFromStores(activeRun);
      if (terminal) {
        saveAlchemySaveDataForExit(save);
      } else {
        void saveAlchemySaveData(save);
      }
    };

    const triggerSave = () => {
      if (!enabledRef.current) return;
      const now = Date.now();
      if (!isDirty) dirtySince = now;
      isDirty = true;
      if (timer) {
        clearTimeout(timer);
      }

      const debounceMs = isAnimationDisabled()
        ? 0
        : readRunPhase() === "battle"
          ? BATTLE_AUTOSAVE_DEBOUNCE_MS
          : AUTOSAVE_DEBOUNCE_MS;
      const maxWaitDelay = Math.max(0, AUTOSAVE_MAX_WAIT_MS - (now - dirtySince));
      timer = setTimeout(
        () => {
          timer = null;
          flush();
        },
        Math.min(debounceMs, maxWaitDelay),
      );
    };

    const unsubscribePersistence = subscribeAlchemyPersistence(triggerSave);

    const handlePageExit = () => {
      flush(true);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush(true);
    };

    window.addEventListener("pagehide", handlePageExit);
    window.addEventListener("beforeunload", handlePageExit);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      unsubscribePersistence();
      window.removeEventListener("pagehide", handlePageExit);
      window.removeEventListener("beforeunload", handlePageExit);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      flush(true);
    };
  }, [enabledRef, runScreenOverrideRef]);
}
