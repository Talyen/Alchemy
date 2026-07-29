// App-level autosave wiring.
// Depends on: saveAlchemySaveData (storage), isAnimationDisabled (game-constants).
// Used by: App.tsx.
import { useEffect, useRef } from "react";
import { readHasActiveRun, resolveActiveRunForSave } from "@/features/alchemy/shared/stores/run-session-facade";
import { saveAlchemySaveData, subscribeAlchemyPersistence } from "@/features/alchemy/shared/storage";
import { buildAlchemySaveDataFromStores } from "@/features/alchemy/shared/storage/build-save-data-from-stores";
import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import type { Screen } from "@/lib/routing";

// Persists the normalized App/controller snapshot whenever a saved field changes.
export function useAlchemyAutosaveFromStores(enabled = true, runScreenOverride: Screen | null = null) {
  const enabledRef = useRef(enabled);
  const runScreenOverrideRef = useRef(runScreenOverride);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    runScreenOverrideRef.current = runScreenOverride;
  }, [runScreenOverride]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let isDirty = false;

    const flush = () => {
      if (!isDirty || !enabledRef.current) return;

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      isDirty = false;

      const activeRun = resolveActiveRunForSave(readHasActiveRun(), runScreenOverrideRef.current ?? undefined);

      void saveAlchemySaveData(buildAlchemySaveDataFromStores(activeRun));
    };

    const triggerSave = () => {
      isDirty = true;
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(
        () => {
          flush();
        },
        isAnimationDisabled() ? 0 : 500,
      );
    };

    const unsubscribePersistence = subscribeAlchemyPersistence(triggerSave);

    const handleBeforeUnload = () => {
      flush();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      unsubscribePersistence();
      window.removeEventListener("beforeunload", handleBeforeUnload);
      flush();
    };
  }, []);
}
