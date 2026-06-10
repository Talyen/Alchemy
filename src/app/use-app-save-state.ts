// App-level autosave wiring.
// Depends on: saveAlchemySaveData (storage), isAnimationDisabled (game-constants).
// Used by: App.tsx.
import { useEffect, useRef } from "react";
import { useRunDomainStore } from "@/features/alchemy/shared/stores/run-session-facade";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { useHomesteadStore } from "@/features/alchemy/shared/stores/homestead-store";
import { resolveActiveRunForSave } from "@/features/alchemy/shared/stores/run-transitions";
import { buildAlchemySaveDataFromStores, saveAlchemySaveData } from "@/features/alchemy/shared/storage";
import { isAnimationDisabled } from "@/lib/game-constants";

// Persists the normalized App/controller snapshot whenever any saved field changes.
export function useAlchemyAutosaveFromStores(enabled = true) {
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

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

      const runDomainState = useRunDomainStore.getState();
      const activeRun = resolveActiveRunForSave(runDomainState.session.hasActiveRun);

      saveAlchemySaveData(buildAlchemySaveDataFromStores(activeRun));
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

    // Subscribe to state changes in all three stores
    const unsubRun = useRunDomainStore.subscribe(triggerSave);
    const unsubApp = useAppStore.subscribe(triggerSave);
    const unsubHome = useHomesteadStore.subscribe(triggerSave);

    const handleBeforeUnload = () => {
      flush();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      unsubRun();
      unsubApp();
      unsubHome();
      window.removeEventListener("beforeunload", handleBeforeUnload);
      flush();
    };
  }, []);
}
