import { create } from "zustand";
import type { CharacterId, DifficultyId } from "@/lib/game-data";
import type { AspectRatioOption, CollectionTab, DisplayMode, UiScale } from "@/features/alchemy/shared/types";
import { clearAlchemySaveData, defaultSaveData, type SaveData } from "@/features/alchemy/shared/storage";

type CollectionPages = Record<CollectionTab, number>;

const initialCollectionPages: CollectionPages = { cards: 0, bestiary: 0, trinkets: 0 };

type AppStore = {
  selectedAspectRatio: AspectRatioOption;
  displayMode: DisplayMode;
  uiScale: UiScale;
  brightness: number;
  musicVol: number;
  sfxVol: number;
  masterVol: number;
  muteInBackground: boolean;
  autoEndTurn: boolean;
  showClearSaveConfirm: boolean;
  collectionTab: CollectionTab;
  collectionPages: CollectionPages;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  completedDifficulties: Record<CharacterId, DifficultyId[]>;
  finishedRunCharacters: CharacterId[];

  setSelectedAspectRatio: (v: AspectRatioOption) => void;
  setDisplayMode: (v: DisplayMode) => void;
  setUiScale: (v: UiScale) => void;
  setBrightness: (v: number) => void;
  setMusicVol: (v: number) => void;
  setSfxVol: (v: number) => void;
  setMasterVol: (v: number) => void;
  setMuteInBackground: (v: boolean) => void;
  setAutoEndTurn: (v: boolean) => void;
  setShowClearSaveConfirm: (v: boolean) => void;
  setDiscoveredCardIds: (v: string[] | ((prev: string[]) => string[])) => void;
  setEncounteredEnemyIds: (v: string[] | ((prev: string[]) => string[])) => void;
  setDiscoveredTrinketIds: (v: string[] | ((prev: string[]) => string[])) => void;
  setCompletedDifficulties: (
    v:
      | Record<CharacterId, DifficultyId[]>
      | ((prev: Record<CharacterId, DifficultyId[]>) => Record<CharacterId, DifficultyId[]>),
  ) => void;
  setFinishedRunCharacters: (v: CharacterId[] | ((prev: CharacterId[]) => CharacterId[])) => void;
  setCollectionPage: (tab: CollectionTab, page: number) => void;

  resetOptionsToDefault: () => void;
  handleCollectionTabChange: (nextTab: CollectionTab) => void;
  clearSavedAppState: () => void;
  initialize: (save: SaveData) => void;
};

export const useAppStore = create<AppStore>()((set) => ({
  selectedAspectRatio: "auto",
  displayMode: "borderless-fullscreen",
  uiScale: "100",
  brightness: 100,
  musicVol: 35,
  sfxVol: 70,
  masterVol: 100,
  muteInBackground: true,
  autoEndTurn: true,
  showClearSaveConfirm: false,
  collectionTab: "cards",
  collectionPages: initialCollectionPages,
  discoveredCardIds: [],
  encounteredEnemyIds: [],
  discoveredTrinketIds: [],
  completedDifficulties: {
    knight: [],
    rogue: [],
    wizard: [],
    ranger: [],
    alchemist: [],
    warlock: [],
    druid: [],
    wildcard: [],
  },
  finishedRunCharacters: [],

  setSelectedAspectRatio: (v) => set({ selectedAspectRatio: v }),
  setDisplayMode: (v) => set({ displayMode: v }),
  setUiScale: (v) => set({ uiScale: v }),
  setBrightness: (v) => set({ brightness: v }),
  setMusicVol: (v) => set({ musicVol: v }),
  setSfxVol: (v) => set({ sfxVol: v }),
  setMasterVol: (v) => set({ masterVol: v }),
  setMuteInBackground: (v) => set({ muteInBackground: v }),
  setAutoEndTurn: (v) => set({ autoEndTurn: v }),
  setShowClearSaveConfirm: (v) => set({ showClearSaveConfirm: v }),
  setDiscoveredCardIds: (v) =>
    set((s) => ({ discoveredCardIds: typeof v === "function" ? v(s.discoveredCardIds) : v })),
  setEncounteredEnemyIds: (v) =>
    set((s) => ({ encounteredEnemyIds: typeof v === "function" ? v(s.encounteredEnemyIds) : v })),
  setDiscoveredTrinketIds: (v) =>
    set((s) => ({ discoveredTrinketIds: typeof v === "function" ? v(s.discoveredTrinketIds) : v })),
  setCompletedDifficulties: (v) =>
    set((s) => ({ completedDifficulties: typeof v === "function" ? v(s.completedDifficulties) : v })),
  setFinishedRunCharacters: (v) =>
    set((s) => ({ finishedRunCharacters: typeof v === "function" ? v(s.finishedRunCharacters) : v })),

  setCollectionPage: (tab, page) =>
    set((s) => ({ collectionPages: { ...s.collectionPages, [tab]: Math.max(0, page) } })),

  resetOptionsToDefault: () => {
    set({
      selectedAspectRatio: defaultSaveData.selectedAspectRatio,
      displayMode: defaultSaveData.displayMode,
      uiScale: defaultSaveData.uiScale,
      brightness: defaultSaveData.brightness,
      masterVol: defaultSaveData.masterVolume,
      musicVol: defaultSaveData.musicVolume,
      sfxVol: defaultSaveData.sfxVolume,
      muteInBackground: defaultSaveData.muteInBackground,
      autoEndTurn: defaultSaveData.autoEndTurn,
    });
  },

  handleCollectionTabChange: (nextTab) =>
    set((s) => ({
      collectionTab: nextTab,
      collectionPages: { ...s.collectionPages, [nextTab]: s.collectionPages[nextTab] ?? 0 },
    })),

  clearSavedAppState: () => {
    void clearAlchemySaveData();
    set({
      selectedAspectRatio: defaultSaveData.selectedAspectRatio,
      displayMode: defaultSaveData.displayMode,
      uiScale: defaultSaveData.uiScale,
      brightness: defaultSaveData.brightness,
      masterVol: defaultSaveData.masterVolume,
      musicVol: defaultSaveData.musicVolume,
      sfxVol: defaultSaveData.sfxVolume,
      muteInBackground: defaultSaveData.muteInBackground,
      autoEndTurn: defaultSaveData.autoEndTurn,
      discoveredCardIds: defaultSaveData.discoveredCardIds,
      encounteredEnemyIds: defaultSaveData.encounteredEnemyIds,
      discoveredTrinketIds: defaultSaveData.discoveredTrinketIds,
      completedDifficulties: defaultSaveData.completedDifficulties,
      finishedRunCharacters: defaultSaveData.finishedRunCharacters,
      collectionPages: initialCollectionPages,
      collectionTab: "cards",
      showClearSaveConfirm: false,
    });
  },

  initialize: (save) =>
    set({
      selectedAspectRatio: save.selectedAspectRatio,
      displayMode: save.displayMode,
      uiScale: save.uiScale,
      brightness: save.brightness,
      musicVol: save.musicVolume,
      sfxVol: save.sfxVolume,
      masterVol: save.masterVolume,
      muteInBackground: save.muteInBackground,
      autoEndTurn: save.autoEndTurn,
      discoveredCardIds: save.discoveredCardIds,
      encounteredEnemyIds: save.encounteredEnemyIds,
      discoveredTrinketIds: save.discoveredTrinketIds,
      completedDifficulties: save.completedDifficulties,
      finishedRunCharacters: save.finishedRunCharacters,
    }),
}));
