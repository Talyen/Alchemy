// App-level autosave wiring.
// Depends on: saveAlchemySaveData (storage), isAnimationDisabled (game-constants).
// Used by: App.tsx.
import { useEffect, useRef } from "react";
import { readHasActiveRun, subscribeRunDomain } from "@/features/alchemy/shared/stores/run-session-facade";
import { useProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";
import { resolveActiveRunForSave } from "@/features/alchemy/shared/stores/run-transitions";
import { saveAlchemySaveData } from "@/features/alchemy/shared/storage";
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

    // Subscribe to state changes in each persistence owner.
    const unsubRun = subscribeRunDomain(triggerSave);
    const unsubProfile = useProfileStore.subscribe(triggerSave);
    const unsubSettings = useSettingsStore.subscribe(triggerSave);
    const unsubGear = useGearStore.subscribe(triggerSave);

    const handleBeforeUnload = () => {
      flush();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      unsubRun();
      unsubProfile();
      unsubSettings();
      unsubGear();
      window.removeEventListener("beforeunload", handleBeforeUnload);
      flush();
    };
  }, []);
}
