// App-level autosave wiring.
// Depends on: saveAlchemySaveData (storage), isAnimationDisabled (game-constants).
// Used by: App.tsx.
import { useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { saveAlchemySaveData, type SaveData } from "@/features/alchemy/storage";
import type { ActiveRunData } from "@/lib/active-run-session";
import { useAppStore } from "@/features/alchemy/stores/app-store";
import { useHomesteadStore } from "@/features/alchemy/stores/homestead-store";
import type { TalentXP } from "@/lib/talents";
import type { UnlockedTalents } from "@/lib/game-data";
import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { isAnimationDisabled } from "@/lib/game-constants";

export type RunAutosaveSlice = {
  talentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
  activeRun: ActiveRunData | null;
};

// Persists the normalized App/controller snapshot whenever any saved field changes.
function useAlchemyAutosave(saveData: SaveData, enabled = true) {
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

export function useAlchemyAutosaveFromStores(runSlice: RunAutosaveSlice, enabled = true) {
  const appPersisted = useAppStore(
    useShallow((s) => ({
      selectedAspectRatio: s.selectedAspectRatio,
      displayMode: s.displayMode,
      uiScale: s.uiScale,
      brightness: s.brightness,
      discoveredCardIds: s.discoveredCardIds,
      encounteredEnemyIds: s.encounteredEnemyIds,
      discoveredTrinketIds: s.discoveredTrinketIds,
      musicVolume: s.musicVol,
      sfxVolume: s.sfxVol,
      masterVolume: s.masterVol,
      muteInBackground: s.muteInBackground,
      autoEndTurn: s.autoEndTurn,
      completedDifficulties: s.completedDifficulties,
    })),
  );
  const homesteadPersisted = useHomesteadStore(
    useShallow((s) => ({
      materialInventory: s.materialInventory,
      constructedBuildings: s.constructedBuildings,
      plantedFarms: s.plantedFarms,
      completedResearch: s.completedResearch,
      bondedCompanions: s.bondedCompanions,
    })),
  );
  const saveData = useMemo<SaveData>(
    () => ({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      gameBuildVersion: CURRENT_GAME_BUILD_VERSION,
      contentVersion: CURRENT_CONTENT_VERSION,
      ...appPersisted,
      talentXP: runSlice.talentXP,
      unlockedTalents: runSlice.unlockedTalents,
      activeRun: runSlice.activeRun,
      ...homesteadPersisted,
    }),
    [appPersisted, homesteadPersisted, runSlice.talentXP, runSlice.unlockedTalents, runSlice.activeRun],
  );
  useAlchemyAutosave(saveData, enabled);
}
