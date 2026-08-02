import { create } from "zustand";
import type { AspectRatioOption, DisplayMode } from "@/features/alchemy/shared/types";
import {
  DEFAULT_BRIGHTNESS_PCT,
  DEFAULT_MASTER_VOLUME_PCT,
  DEFAULT_MUSIC_VOLUME_PCT,
  DEFAULT_SFX_VOLUME_PCT,
} from "@/lib/game-constants";
import type { PersistenceCodec } from "./persistence-codec";

export interface SettingsSaveFields {
  selectedAspectRatio: AspectRatioOption;
  displayMode: DisplayMode;
  brightness: number;
  musicVolume: number;
  sfxVolume: number;
  masterVolume: number;
  muteInBackground: boolean;
  autoEndTurn: boolean;
}

export interface SettingsStore {
  selectedAspectRatio: SettingsSaveFields["selectedAspectRatio"];
  displayMode: SettingsSaveFields["displayMode"];
  brightness: SettingsSaveFields["brightness"];
  musicVol: SettingsSaveFields["musicVolume"];
  sfxVol: SettingsSaveFields["sfxVolume"];
  masterVol: SettingsSaveFields["masterVolume"];
  muteInBackground: SettingsSaveFields["muteInBackground"];
  autoEndTurn: SettingsSaveFields["autoEndTurn"];
  showClearSaveConfirm: boolean;

  setSelectedAspectRatio: (value: AspectRatioOption) => void;
  setDisplayMode: (value: DisplayMode) => void;
  setBrightness: (value: number) => void;
  setMusicVol: (value: number) => void;
  setSfxVol: (value: number) => void;
  setMasterVol: (value: number) => void;
  setMuteInBackground: (value: boolean) => void;
  setAutoEndTurn: (value: boolean) => void;
  setShowClearSaveConfirm: (value: boolean) => void;
  resetToDefaults: () => void;
}

function createDefaultSettingsSaveFields(): SettingsSaveFields {
  return {
    selectedAspectRatio: "auto",
    displayMode: "borderless-fullscreen",
    brightness: DEFAULT_BRIGHTNESS_PCT,
    musicVolume: DEFAULT_MUSIC_VOLUME_PCT,
    sfxVolume: DEFAULT_SFX_VOLUME_PCT,
    masterVolume: DEFAULT_MASTER_VOLUME_PCT,
    muteInBackground: true,
    autoEndTurn: true,
  };
}

function settingsStoreFields(fields: SettingsSaveFields) {
  return {
    selectedAspectRatio: fields.selectedAspectRatio,
    displayMode: fields.displayMode,
    brightness: fields.brightness,
    musicVol: fields.musicVolume,
    sfxVol: fields.sfxVolume,
    masterVol: fields.masterVolume,
    muteInBackground: fields.muteInBackground,
    autoEndTurn: fields.autoEndTurn,
  };
}

export const useSettingsStore = create<SettingsStore>()((set) => ({
  ...settingsStoreFields(createDefaultSettingsSaveFields()),
  showClearSaveConfirm: false,

  setSelectedAspectRatio: (selectedAspectRatio) => set({ selectedAspectRatio }),
  setDisplayMode: (displayMode) => set({ displayMode }),
  setBrightness: (brightness) => set({ brightness }),
  setMusicVol: (musicVol) => set({ musicVol }),
  setSfxVol: (sfxVol) => set({ sfxVol }),
  setMasterVol: (masterVol) => set({ masterVol }),
  setMuteInBackground: (muteInBackground) => set({ muteInBackground }),
  setAutoEndTurn: (autoEndTurn) => set({ autoEndTurn }),
  setShowClearSaveConfirm: (showClearSaveConfirm) => set({ showClearSaveConfirm }),
  resetToDefaults: () =>
    set({ ...settingsStoreFields(createDefaultSettingsSaveFields()), showClearSaveConfirm: false }),
}));

export const settingsPersistenceCodec: PersistenceCodec<SettingsSaveFields> = {
  createDefault: createDefaultSettingsSaveFields,
  encode: () => {
    const state = useSettingsStore.getState();
    return {
      selectedAspectRatio: state.selectedAspectRatio,
      displayMode: state.displayMode,
      brightness: state.brightness,
      musicVolume: state.musicVol,
      sfxVolume: state.sfxVol,
      masterVolume: state.masterVol,
      muteInBackground: state.muteInBackground,
      autoEndTurn: state.autoEndTurn,
    };
  },
  hydrate: (fields) => {
    useSettingsStore.setState(settingsStoreFields(fields));
  },
  subscribe: (listener) => useSettingsStore.subscribe(listener),
};
