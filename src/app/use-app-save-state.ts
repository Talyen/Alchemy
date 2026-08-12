// App-level autosave wiring.
// Depends on: saveAlchemySaveData (storage), isAnimationDisabled (game-constants).
// Used by: App.tsx.
import { useEffect } from "react";
import { readHasActiveRun, readRunPhase } from "@/features/alchemy/shared/stores/run-session-read-port";
import { resolveActiveRunForSave } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { useLatestRef } from "@/features/alchemy/shared/hooks";
import {
  saveAlchemySaveData,
  saveAlchemySaveDataForExit,
  subscribeAlchemyPersistence,
} from "@/features/alchemy/shared/storage";
import { buildAlchemySaveDataFromStores } from "@/features/alchemy/shared/storage/build-save-data-from-stores";
import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import { AUTOSAVE_DEBOUNCE_MS, BATTLE_AUTOSAVE_DEBOUNCE_MS } from "@/lib/game-constants";
import type { Screen } from "@/lib/routing";

// Persists the normalized App/controller snapshot whenever a saved field changes.
export function useAlchemyAutosaveFromStores(enabled = true, runScreenOverride: Screen | null = null) {
  const enabledRef = useLatestRef(enabled);
  const runScreenOverrideRef = useLatestRef(runScreenOverride);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let isDirty = false;

    const flush = (terminal = false) => {
      if (!isDirty || !enabledRef.current) return;

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      isDirty = false;

      const activeRun = resolveActiveRunForSave(readHasActiveRun(), runScreenOverrideRef.current ?? undefined);

      const save = buildAlchemySaveDataFromStores(activeRun);
      if (terminal) {
        saveAlchemySaveDataForExit(save);
      } else {
        void saveAlchemySaveData(save);
      }
    };

    const triggerSave = () => {
      isDirty = true;
      if (timer) {
        clearTimeout(timer);
      }
      // Battle-screen commits are the highest-frequency writes; debounce them
      // longer so the full-save serialization doesn't hitch every quiet gap.
      // Terminal pagehide/visibilitychange flushes are unaffected and still
      // persist the freshest battle state for crash-resume.
      const debounceMs = isAnimationDisabled()
        ? 0
        : readRunPhase() === "battle"
          ? BATTLE_AUTOSAVE_DEBOUNCE_MS
          : AUTOSAVE_DEBOUNCE_MS;
      timer = setTimeout(() => {
        flush();
      }, debounceMs);
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
      flush();
    };
  }, [enabledRef, runScreenOverrideRef]);
}
