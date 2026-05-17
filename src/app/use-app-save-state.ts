// App-level save state and autosave wiring for options, discoveries, and collection UI.
// Depends on alchemy storage helpers plus persisted option and collection type contracts.
import { useEffect, useRef, useState } from "react";

import {
  clearAlchemySaveData,
  loadAlchemySaveState,
  saveAlchemySaveData,
  type SaveData,
} from "@/features/alchemy/storage";
import { defaultSaveData } from "@/features/alchemy/storage/defaults";
import type { CharacterId, DifficultyId } from "@/lib/game-data";
import type { CollectionTab, DisplayMode, ResolutionOption, UiScale } from "@/features/alchemy/types";

type CollectionPages = Record<CollectionTab, number>;

const initialCollectionPages: CollectionPages = {
  cards: 0,
  bestiary: 0,
  trinkets: 0,
};

// Owns persisted shell state so App can focus on controller composition and screen rendering.
export function useAppSaveState() {
  const initialSaveRef = useRef(loadAlchemySaveState());
  const initialSave = initialSaveRef.current.data;
  const saveLoadStatus = initialSaveRef.current.status;
  const [selectedResolution, setSelectedResolution] = useState<ResolutionOption>(initialSave.selectedResolution);
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
  const [completedDifficulties, setCompletedDifficulties] = useState<Record<CharacterId, DifficultyId[]>>(initialSave.completedDifficulties);

  function resetOptionsToDefault() {
    setSelectedResolution(defaultSaveData.selectedResolution);
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
    setCollectionPages((current) => ({ ...current, [nextTab]: current[nextTab] ?? 0 }));
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
    selectedResolution,
    setSelectedResolution,
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
export function useAlchemyAutosave(saveData: SaveData) {
  useEffect(() => {
    saveAlchemySaveData(saveData);
  }, [
    saveData.saveSchemaVersion,
    saveData.gameBuildVersion,
    saveData.contentVersion,
    saveData.selectedResolution,
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
  ]);
}
