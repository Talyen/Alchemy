// App-level autosave wiring.
// Depends on: saveAlchemySaveData (storage), isAnimationDisabled (game-constants).
// Used by: App.tsx.
import { useEffect, useRef } from "react";
import { saveAlchemySaveData, type SaveData } from "@/features/alchemy/storage";
import { isAnimationDisabled } from "@/lib/game-constants";

// Persists the normalized App/controller snapshot whenever any saved field changes.
export function useAlchemyAutosave(saveData: SaveData, enabled = true) {
  const latestDataRef = useRef<SaveData>(saveData);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    latestDataRef.current = saveData;
    enabledRef.current = enabled;
  });

  const isDirtyRef = useRef<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const flush = () => {
    if (!isDirtyRef.current || !enabledRef.current) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    isDirtyRef.current = false;
    saveAlchemySaveData(latestDataRef.current);
  };

  useEffect(() => {
    if (!enabled) {
      isDirtyRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    isDirtyRef.current = true;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(
      () => {
        flush();
      },
      isAnimationDisabled() ? 0 : 500,
    );
  }, [
    saveData.saveSchemaVersion,
    saveData.gameBuildVersion,
    saveData.contentVersion,
    saveData.selectedAspectRatio,
    saveData.displayMode,
    saveData.uiScale,
    saveData.discoveredCardIds,
    saveData.encounteredEnemyIds,
    saveData.discoveredTrinketIds,
    saveData.talentXP,
    saveData.unlockedTalents,
    saveData.musicVolume,
    saveData.sfxVolume,
    saveData.masterVolume,
    saveData.muteInBackground,
    saveData.autoEndTurn,
    saveData.brightness,
    saveData.activeRun,
    saveData.materialInventory,
    saveData.constructedBuildings,
    saveData.plantedFarms,
    saveData.completedResearch,
    saveData.bondedCompanions,
    saveData.completedDifficulties,
    enabled,
  ]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      flush();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    return () => {
      flush();
    };
  }, []);
}
