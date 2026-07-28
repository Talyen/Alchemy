import { create } from "zustand";
import type { AspectRatioOption, DisplayMode, UiScale } from "@/features/alchemy/shared/types";
import { defaultSaveData, type SaveData } from "@/features/alchemy/shared/storage";

export interface SettingsStore {
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

  setSelectedAspectRatio: (value: AspectRatioOption) => void;
  setDisplayMode: (value: DisplayMode) => void;
  setUiScale: (value: UiScale) => void;
  setBrightness: (value: number) => void;
  setMusicVol: (value: number) => void;
  setSfxVol: (value: number) => void;
  setMasterVol: (value: number) => void;
  setMuteInBackground: (value: boolean) => void;
  setAutoEndTurn: (value: boolean) => void;
  setShowClearSaveConfirm: (value: boolean) => void;
  resetToDefaults: () => void;
  initialize: (save: SaveData) => void;
}

function savedSettings(save: SaveData) {
  return {
    selectedAspectRatio: save.selectedAspectRatio,
    displayMode: save.displayMode,
    uiScale: save.uiScale,
    brightness: save.brightness,
    musicVol: save.musicVolume,
    sfxVol: save.sfxVolume,
    masterVol: save.masterVolume,
    muteInBackground: save.muteInBackground,
    autoEndTurn: save.autoEndTurn,
  };
}

export const useSettingsStore = create<SettingsStore>()((set) => ({
  ...savedSettings(defaultSaveData),
  showClearSaveConfirm: false,

  setSelectedAspectRatio: (selectedAspectRatio) => set({ selectedAspectRatio }),
  setDisplayMode: (displayMode) => set({ displayMode }),
  setUiScale: (uiScale) => set({ uiScale }),
  setBrightness: (brightness) => set({ brightness }),
  setMusicVol: (musicVol) => set({ musicVol }),
  setSfxVol: (sfxVol) => set({ sfxVol }),
  setMasterVol: (masterVol) => set({ masterVol }),
  setMuteInBackground: (muteInBackground) => set({ muteInBackground }),
  setAutoEndTurn: (autoEndTurn) => set({ autoEndTurn }),
  setShowClearSaveConfirm: (showClearSaveConfirm) => set({ showClearSaveConfirm }),
  resetToDefaults: () => set({ ...savedSettings(defaultSaveData), showClearSaveConfirm: false }),
  initialize: (save) => set(savedSettings(save)),
}));
