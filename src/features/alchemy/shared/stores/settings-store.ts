import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { defaultGameSession } from "@/app/application-session";
import { sessionRuntime } from "./session-runtime";
import {
  createSettingsPersistenceCodec,
  selectSettingsSaveFields,
  type SettingsActions,
  type SettingsSaveFields,
  type SettingsStore,
} from "./settings-state";
export type { SettingsActions, SettingsSaveFields, SettingsStore } from "./settings-state";
const applicationStore = sessionRuntime(defaultGameSession).settings;
export const useSettingsStore = Object.assign(
  <T>(selector: (state: SettingsStore) => T): T => useStore(applicationStore, selector),
  applicationStore,
);
export const settingsPersistenceCodec = createSettingsPersistenceCodec(applicationStore);

function selectSettingsActions(state: SettingsStore): SettingsActions {
  return {
    setDisplayMode: state.setDisplayMode,
    setBrightness: state.setBrightness,
    setBackgroundParticlesIntensity: state.setBackgroundParticlesIntensity,
    setBackgroundGlowIntensity: state.setBackgroundGlowIntensity,
    setMasterVolume: state.setMasterVolume,
    setMusicVolume: state.setMusicVolume,
    setSfxVolume: state.setSfxVolume,
    setMuteInBackground: state.setMuteInBackground,
    setBossLyricsEnabled: state.setBossLyricsEnabled,
    setAutoEndTurn: state.setAutoEndTurn,
    setRememberAutoplayPreference: state.setRememberAutoplayPreference,
    setAutoplayEnabled: state.setAutoplayEnabled,
    resetToDefaults: state.resetToDefaults,
  };
}

export function useSettingsActions(): SettingsActions {
  return useSettingsStore(useShallow(selectSettingsActions));
}

export type AppSettings = SettingsSaveFields;

export function useAppSettings(): AppSettings {
  return useSettingsStore(useShallow(selectSettingsSaveFields));
}
