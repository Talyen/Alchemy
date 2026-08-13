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
  rememberAutoplayPreference: boolean;
  autoplayEnabled: boolean;
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
  rememberAutoplayPreference: SettingsSaveFields["rememberAutoplayPreference"];
  autoplayEnabled: SettingsSaveFields["autoplayEnabled"];
  showClearSaveConfirm: boolean;

  setSelectedAspectRatio: (value: AspectRatioOption) => void;
  setDisplayMode: (value: DisplayMode) => void;
  setBrightness: (value: number) => void;
  setMusicVol: (value: number) => void;
  setSfxVol: (value: number) => void;
  setMasterVol: (value: number) => void;
  setMuteInBackground: (value: boolean) => void;
  setAutoEndTurn: (value: boolean) => void;
  setRememberAutoplayPreference: (value: boolean) => void;
  setAutoplayEnabled: (value: boolean) => void;
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
    rememberAutoplayPreference: false,
    autoplayEnabled: false,
  };
}

export function preferredAutoplayEnabled(fields: {
  rememberAutoplayPreference: boolean;
  autoplayEnabled: boolean;
}): boolean {
  return fields.rememberAutoplayPreference && fields.autoplayEnabled;
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
    rememberAutoplayPreference: fields.rememberAutoplayPreference,
    autoplayEnabled: fields.rememberAutoplayPreference && fields.autoplayEnabled,
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
  setRememberAutoplayPreference: (rememberAutoplayPreference) =>
    set((state) => ({
      rememberAutoplayPreference,
      autoplayEnabled: rememberAutoplayPreference ? state.autoplayEnabled : false,
    })),
  setAutoplayEnabled: (autoplayEnabled) => set({ autoplayEnabled }),
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
      rememberAutoplayPreference: state.rememberAutoplayPreference,
      autoplayEnabled: state.rememberAutoplayPreference && state.autoplayEnabled,
    };
  },
  hydrate: (fields) => {
    useSettingsStore.setState(settingsStoreFields(fields));
  },
  subscribe: (listener) => useSettingsStore.subscribe(listener),
};
