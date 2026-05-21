// App-level save state and autosave wiring for options, discoveries, and collection UI.
// Depends on alchemy storage helpers plus persisted option and collection type contracts.
import { useEffect, useState } from "react";

import {
  clearAlchemySaveData,
  loadAlchemySaveState,
  saveAlchemySaveData,
  type SaveData,
} from "@/features/alchemy/storage";
import { defaultSaveData } from "@/features/alchemy/storage/defaults";
import type { CharacterId, DifficultyId } from "@/lib/game-data";
import type { AspectRatioOption, CollectionTab, DisplayMode, UiScale } from "@/features/alchemy/types";

type CollectionPages = Record<CollectionTab, number>;

const initialCollectionPages: CollectionPages = {
  cards: 0,
  bestiary: 0,
  trinkets: 0,
};

// Owns persisted shell state so App can focus on controller composition and screen rendering.
// loadAlchemySaveState() is called synchronously during hook initialization (not lazily) so
// React state is seeded with real save data on the very first render, avoiding a flash of defaults.
export function useAppSaveState() {
  // loadAlchemySaveState is already guarded internally; any error returns defaultSaveData.
  const initialLoad = loadAlchemySaveState();
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
  const {
    saveSchemaVersion,
    gameBuildVersion,
    contentVersion,
    selectedAspectRatio,
    displayMode,
    uiScale,
    discoveredCardIds,
    encounteredEnemyIds,
    discoveredTrinketIds,
    talentXP,
    unlockedTalents,
    musicVolume,
    sfxVolume,
    masterVolume,
    muteInBackground,
    autoEndTurn,
    brightness,
    activeRun,
    materialInventory,
    constructedBuildings,
    plantedFarms,
    completedResearch,
    bondedCompanions,
    completedDifficulties,
  } = saveData;

  useEffect(() => {
    if (!enabled) return;
    saveAlchemySaveData({
      saveSchemaVersion,
      gameBuildVersion,
      contentVersion,
      selectedAspectRatio,
      displayMode,
      uiScale,
      discoveredCardIds,
      encounteredEnemyIds,
      discoveredTrinketIds,
      talentXP,
      unlockedTalents,
      musicVolume,
      sfxVolume,
      masterVolume,
      muteInBackground,
      autoEndTurn,
      brightness,
      activeRun,
      materialInventory,
      constructedBuildings,
      plantedFarms,
      completedResearch,
      bondedCompanions,
      completedDifficulties,
    });
  }, [
    saveSchemaVersion,
    gameBuildVersion,
    contentVersion,
    selectedAspectRatio,
    displayMode,
    uiScale,
    discoveredCardIds,
    encounteredEnemyIds,
    discoveredTrinketIds,
    talentXP,
    unlockedTalents,
    musicVolume,
    sfxVolume,
    masterVolume,
    muteInBackground,
    autoEndTurn,
    brightness,
    activeRun,
    materialInventory,
    constructedBuildings,
    plantedFarms,
    completedResearch,
    bondedCompanions,
    completedDifficulties,
    enabled,
  ]);
}
