import { create } from "zustand";
import type { AspectRatioOption, DisplayMode } from "@/features/alchemy/shared/types";
import {
  DEFAULT_BRIGHTNESS_PCT,
  DEFAULT_MASTER_VOLUME_PCT,
  DEFAULT_MUSIC_VOLUME_PCT,
  DEFAULT_SFX_VOLUME_PCT,
} from "@/lib/game-constants";
import type { StandalonePersistenceCodec } from "./persistence-codec";

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
  musicVolume: SettingsSaveFields["musicVolume"];
  sfxVolume: SettingsSaveFields["sfxVolume"];
  masterVolume: SettingsSaveFields["masterVolume"];
  muteInBackground: SettingsSaveFields["muteInBackground"];
  autoEndTurn: SettingsSaveFields["autoEndTurn"];
  rememberAutoplayPreference: SettingsSaveFields["rememberAutoplayPreference"];
  autoplayEnabled: SettingsSaveFields["autoplayEnabled"];
  showClearSaveConfirm: boolean;

  setSelectedAspectRatio: (value: AspectRatioOption) => void;
  setDisplayMode: (value: DisplayMode) => void;
  setBrightness: (value: number) => void;
  setMusicVolume: (value: number) => void;
  setSfxVolume: (value: number) => void;
  setMasterVolume: (value: number) => void;
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

function withDerivedAutoplay<T extends { rememberAutoplayPreference: boolean; autoplayEnabled: boolean }>(
  fields: T,
): T {
  return { ...fields, autoplayEnabled: fields.rememberAutoplayPreference && fields.autoplayEnabled };
}

export const useSettingsStore = create<SettingsStore>()((set) => ({
  ...withDerivedAutoplay(createDefaultSettingsSaveFields()),
  showClearSaveConfirm: false,

  setSelectedAspectRatio: (selectedAspectRatio) => set({ selectedAspectRatio }),
  setDisplayMode: (displayMode) => set({ displayMode }),
  setBrightness: (brightness) => set({ brightness }),
  setMusicVolume: (musicVolume) => set({ musicVolume }),
  setSfxVolume: (sfxVolume) => set({ sfxVolume }),
  setMasterVolume: (masterVolume) => set({ masterVolume }),
  setMuteInBackground: (muteInBackground) => set({ muteInBackground }),
  setAutoEndTurn: (autoEndTurn) => set({ autoEndTurn }),
  setRememberAutoplayPreference: (rememberAutoplayPreference) =>
    set((state) => ({
      rememberAutoplayPreference,
      autoplayEnabled: rememberAutoplayPreference ? state.autoplayEnabled : false,
    })),
  setAutoplayEnabled: (autoplayEnabled) => set((state) => withDerivedAutoplay({ ...state, autoplayEnabled })),
  setShowClearSaveConfirm: (showClearSaveConfirm) => set({ showClearSaveConfirm }),
  resetToDefaults: () =>
    set({ ...withDerivedAutoplay(createDefaultSettingsSaveFields()), showClearSaveConfirm: false }),
}));

function toSaveFields(state: Pick<SettingsStore, keyof SettingsSaveFields>): SettingsSaveFields {
  return {
    selectedAspectRatio: state.selectedAspectRatio,
    displayMode: state.displayMode,
    brightness: state.brightness,
    musicVolume: state.musicVolume,
    sfxVolume: state.sfxVolume,
    masterVolume: state.masterVolume,
    muteInBackground: state.muteInBackground,
    autoEndTurn: state.autoEndTurn,
    rememberAutoplayPreference: state.rememberAutoplayPreference,
    autoplayEnabled: state.autoplayEnabled,
  };
}

export const settingsPersistenceCodec: StandalonePersistenceCodec<SettingsSaveFields> = {
  createDefault: createDefaultSettingsSaveFields,
  encode: () => withDerivedAutoplay(toSaveFields(useSettingsStore.getState())),
  hydrate: (fields) => {
    useSettingsStore.setState(withDerivedAutoplay(toSaveFields(fields)));
  },
  subscribe: (listener) => useSettingsStore.subscribe(listener),
};
