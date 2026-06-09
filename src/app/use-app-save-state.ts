// App-level autosave wiring.
// Depends on: saveAlchemySaveData (storage), isAnimationDisabled (game-constants).
// Used by: App.tsx.
import { useEffect, useRef } from "react";
import { useRunDomainStore } from "@/features/alchemy/shared/stores/run-session-facade";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { useHomesteadStore } from "@/features/alchemy/shared/stores/homestead-store";
import { snapshotRun } from "@/features/alchemy/shared/stores/run-transitions";
import { saveAlchemySaveData } from "@/features/alchemy/shared/storage";
import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
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
      const appState = useAppStore.getState();
      const homesteadState = useHomesteadStore.getState();

      const activeRun = runDomainState.session.hasActiveRun ? snapshotRun() : null;

      const saveData = {
        saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
        gameBuildVersion: CURRENT_GAME_BUILD_VERSION,
        contentVersion: CURRENT_CONTENT_VERSION,
        selectedAspectRatio: appState.selectedAspectRatio,
        displayMode: appState.displayMode,
        uiScale: appState.uiScale,
        brightness: appState.brightness,
        discoveredCardIds: appState.discoveredCardIds,
        encounteredEnemyIds: appState.encounteredEnemyIds,
        discoveredTrinketIds: appState.discoveredTrinketIds,
        musicVolume: appState.musicVol,
        sfxVolume: appState.sfxVol,
        masterVolume: appState.masterVol,
        muteInBackground: appState.muteInBackground,
        autoEndTurn: appState.autoEndTurn,
        completedDifficulties: appState.completedDifficulties,
        talentXP: runDomainState.progress.talentXP,
        unlockedTalents: runDomainState.progress.unlockedTalents,
        activeRun,
        materialInventory: homesteadState.materialInventory,
        constructedBuildings: homesteadState.constructedBuildings,
        plantedFarms: homesteadState.plantedFarms,
        completedResearch: homesteadState.completedResearch,
        bondedCompanions: homesteadState.bondedCompanions,
      };

      saveAlchemySaveData(saveData);
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
