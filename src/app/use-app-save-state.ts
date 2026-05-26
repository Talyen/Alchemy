// App-level save state and autosave wiring for options, discoveries, and collection UI.
// Depends on alchemy storage helpers plus persisted option and collection type contracts.
import { useEffect, useRef, useState } from "react";

import {
  clearAlchemySaveData,
  saveAlchemySaveData,
  type SaveData,
  type SaveLoadState,
} from "@/features/alchemy/storage";
import { defaultSaveData } from "@/features/alchemy/storage/defaults";
import type { CharacterId, DifficultyId } from "@/lib/game-data";
import { isAnimationDisabled } from "@/lib/game-constants";
import type { AspectRatioOption, CollectionTab, DisplayMode, UiScale } from "@/features/alchemy/types";

type CollectionPages = Record<CollectionTab, number>;

const initialCollectionPages: CollectionPages = {
  cards: 0,
  bestiary: 0,
  trinkets: 0,
};

// Owns persisted shell state so App can focus on controller composition and screen rendering.
export function useAppSaveState(initialLoad: SaveLoadState) {
  const initialSave = initialLoad.data;
  const saveLoadStatus = initialLoad.status;
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatioOption>(initialSave.selectedAspectRatio);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(initialSave.displayMode);
  const [uiScale, setUiScale] = useState<UiScale>(initialSave.uiScale);
  const [brightness, setBrightness] = useState(initialSave.brightness);
  const [musicVol, setMusicVol] = useState(initialSave.musicVolume);
  const [sfxVol, setSfxVol] = useState(initialSave.sfxVolume);
  const [masterVol, setMasterVol] = useState(initialSave.masterVolume);
  const [muteInBackground, setMuteInBackground] = useState(initialSave.muteInBackground);
  const [autoEndTurn, setAutoEndTurn] = useState(initialSave.autoEndTurn);
  const [showClearSaveConfirm, setShowClearSaveConfirm] = useState(false);
  const [collectionTab, setCollectionTab] = useState<CollectionTab>("cards");
  const [collectionPages, setCollectionPages] = useState<CollectionPages>(initialCollectionPages);
  const [discoveredCardIds, setDiscoveredCardIds] = useState<string[]>(initialSave.discoveredCardIds);
  const [encounteredEnemyIds, setEncounteredEnemyIds] = useState<string[]>(initialSave.encounteredEnemyIds);
  const [discoveredTrinketIds, setDiscoveredTrinketIds] = useState<string[]>(initialSave.discoveredTrinketIds);
  const [completedDifficulties, setCompletedDifficulties] = useState<Record<CharacterId, DifficultyId[]>>(
    initialSave.completedDifficulties,
  );

  function resetOptionsToDefault() {
    setSelectedAspectRatio(defaultSaveData.selectedAspectRatio);
    setDisplayMode(defaultSaveData.displayMode);
    setUiScale(defaultSaveData.uiScale);
    setBrightness(defaultSaveData.brightness);
    setMasterVol(defaultSaveData.masterVolume);
    setMusicVol(defaultSaveData.musicVolume);
    setSfxVol(defaultSaveData.sfxVolume);
    setMuteInBackground(defaultSaveData.muteInBackground);
    setAutoEndTurn(defaultSaveData.autoEndTurn);
  }

  function handleCollectionTabChange(nextTab: CollectionTab) {
    setCollectionTab(nextTab);
    // initialCollectionPages seeds every CollectionTab with 0, so current[nextTab] is always
    // defined for valid tab values. No fallback needed — keeping the access explicit aids readability.
    setCollectionPages((current) => ({ ...current, [nextTab]: current[nextTab] }));
  }

  function setCollectionPage(tab: CollectionTab, page: number) {
    setCollectionPages((current) => ({ ...current, [tab]: Math.max(0, page) }));
  }

  function clearSavedAppState() {
    clearAlchemySaveData();
    resetOptionsToDefault();
    setDiscoveredCardIds(defaultSaveData.discoveredCardIds);
    setEncounteredEnemyIds(defaultSaveData.encounteredEnemyIds);
    setDiscoveredTrinketIds(defaultSaveData.discoveredTrinketIds);
    setCompletedDifficulties(defaultSaveData.completedDifficulties);
    setCollectionPages(initialCollectionPages);
    setCollectionTab("cards");
    setShowClearSaveConfirm(false);
  }

  return {
    initialSave,
    saveLoadStatus,
    selectedAspectRatio,
    setSelectedAspectRatio,
    displayMode,
    setDisplayMode,
    uiScale,
    setUiScale,
    brightness,
    setBrightness,
    musicVol,
    setMusicVol,
    sfxVol,
    setSfxVol,
    masterVol,
    setMasterVol,
    muteInBackground,
    setMuteInBackground,
    autoEndTurn,
    setAutoEndTurn,
    showClearSaveConfirm,
    setShowClearSaveConfirm,
    collectionTab,
    collectionPages,
    handleCollectionTabChange,
    setCollectionPage,
    discoveredCardIds,
    setDiscoveredCardIds,
    encounteredEnemyIds,
    setEncounteredEnemyIds,
    discoveredTrinketIds,
    setDiscoveredTrinketIds,
    completedDifficulties,
    setCompletedDifficulties,
    resetOptionsToDefault,
    clearSavedAppState,
  };
}

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
