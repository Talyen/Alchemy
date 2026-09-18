import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { AspectRatioOption, DisplayMode } from "@/features/alchemy/shared/types";
import {
  DEFAULT_BACKGROUND_GLOW_PCT,
  DEFAULT_BACKGROUND_PARTICLES_PCT,
  DEFAULT_BRIGHTNESS_PCT,
  DEFAULT_MASTER_VOLUME_PCT,
  DEFAULT_MUSIC_VOLUME_PCT,
  DEFAULT_SFX_VOLUME_PCT,
} from "@/lib/game-constants";
import type { StandalonePersistenceCodec } from "./persistence-codec";
import {
  clampBrightnessPct,
  clampSpecialEffectsPct,
  clampVolumePct,
  resolveAutoplayEnabled,
} from "@/lib/settings-values";

export interface SettingsSaveFields {
  selectedAspectRatio: AspectRatioOption;
  displayMode: DisplayMode;
  brightness: number;
  backgroundParticlesIntensity: number;
  backgroundGlowIntensity: number;
  musicVolume: number;
  sfxVolume: number;
  masterVolume: number;
  muteInBackground: boolean;
  autoEndTurn: boolean;
  rememberAutoplayPreference: boolean;
  autoplayEnabled: boolean;
}

export interface SettingsStore extends SettingsSaveFields {
  setSelectedAspectRatio: (value: AspectRatioOption) => void;
  setDisplayMode: (value: DisplayMode) => void;
  setBrightness: (value: number) => void;
  setBackgroundParticlesIntensity: (value: number) => void;
  setBackgroundGlowIntensity: (value: number) => void;
  setMusicVolume: (value: number) => void;
  setSfxVolume: (value: number) => void;
  setMasterVolume: (value: number) => void;
  setMuteInBackground: (value: boolean) => void;
  setAutoEndTurn: (value: boolean) => void;
  setRememberAutoplayPreference: (value: boolean) => void;
  setAutoplayEnabled: (value: boolean) => void;
  resetToDefaults: () => void;
}

export function createDefaultSettingsSaveFields(): SettingsSaveFields {
  return {
    selectedAspectRatio: "auto",
    displayMode: "borderless-fullscreen",
    brightness: DEFAULT_BRIGHTNESS_PCT,
    backgroundParticlesIntensity: DEFAULT_BACKGROUND_PARTICLES_PCT,
    backgroundGlowIntensity: DEFAULT_BACKGROUND_GLOW_PCT,
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
  return resolveAutoplayEnabled(fields);
}

// Live writes clamp through the shared settings-values helpers (the same
// ranges the save schema enforces on load), so in-memory state can never hold
// an out-of-range value that load would silently repair.
export const useSettingsStore = create<SettingsStore>()((set) => ({
  ...createDefaultSettingsSaveFields(),

  setSelectedAspectRatio: (selectedAspectRatio) => set({ selectedAspectRatio }),
  setDisplayMode: (displayMode) => set({ displayMode }),
  setBrightness: (brightness) => set({ brightness: clampBrightnessPct(brightness) }),
  setBackgroundParticlesIntensity: (backgroundParticlesIntensity) =>
    set({ backgroundParticlesIntensity: clampSpecialEffectsPct(backgroundParticlesIntensity) }),
  setBackgroundGlowIntensity: (backgroundGlowIntensity) =>
    set({ backgroundGlowIntensity: clampSpecialEffectsPct(backgroundGlowIntensity) }),
  setMusicVolume: (musicVolume) => set({ musicVolume: clampVolumePct(musicVolume) }),
  setSfxVolume: (sfxVolume) => set({ sfxVolume: clampVolumePct(sfxVolume) }),
  setMasterVolume: (masterVolume) => set({ masterVolume: clampVolumePct(masterVolume) }),
  setMuteInBackground: (muteInBackground) => set({ muteInBackground }),
  setAutoEndTurn: (autoEndTurn) => set({ autoEndTurn }),
  setRememberAutoplayPreference: (rememberAutoplayPreference) =>
    set((state) => ({
      rememberAutoplayPreference,
      // Intentional: turning remember off clears the stored autoplay choice
      // (pinned by profile-settings-stores test), it does not pause it.
      autoplayEnabled: rememberAutoplayPreference ? state.autoplayEnabled : false,
    })),
  setAutoplayEnabled: (autoplayEnabled) => set({ autoplayEnabled }),
  resetToDefaults: () => set({ ...createDefaultSettingsSaveFields() }),
}));

function selectSettingsSaveFields(state: Pick<SettingsStore, keyof SettingsSaveFields>): SettingsSaveFields {
  return {
    selectedAspectRatio: state.selectedAspectRatio,
    displayMode: state.displayMode,
    brightness: state.brightness,
    backgroundParticlesIntensity: state.backgroundParticlesIntensity,
    backgroundGlowIntensity: state.backgroundGlowIntensity,
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
  // Pure selection: the live invariant is owned by the setters above (which
  // clamp on every write), load repair by SaveDataSchema, and direct-hydrate
  // safety by hydrate below. Encode adds no further derivation.
  encode: () => selectSettingsSaveFields(useSettingsStore.getState()),
  hydrate: (fields) => {
    const selected = selectSettingsSaveFields(fields);
    useSettingsStore.setState({
      ...selected,
      brightness: clampBrightnessPct(selected.brightness),
      backgroundParticlesIntensity: clampSpecialEffectsPct(selected.backgroundParticlesIntensity),
      backgroundGlowIntensity: clampSpecialEffectsPct(selected.backgroundGlowIntensity),
      musicVolume: clampVolumePct(selected.musicVolume),
      sfxVolume: clampVolumePct(selected.sfxVolume),
      masterVolume: clampVolumePct(selected.masterVolume),
      // Load repair: a stored "on" with remember off hydrates to off, matching
      // SaveDataSchema. Turning remember off at runtime clears the stored
      // choice instead (see setRememberAutoplayPreference above).
      autoplayEnabled: resolveAutoplayEnabled(selected),
    });
  },
};

export type SettingsActions = Pick<
  SettingsStore,
  | "setSelectedAspectRatio"
  | "setDisplayMode"
  | "setBrightness"
  | "setBackgroundParticlesIntensity"
  | "setBackgroundGlowIntensity"
  | "setMasterVolume"
  | "setMusicVolume"
  | "setSfxVolume"
  | "setMuteInBackground"
  | "setAutoEndTurn"
  | "setRememberAutoplayPreference"
  | "setAutoplayEnabled"
  | "resetToDefaults"
>;

function selectSettingsActions(state: SettingsStore): SettingsActions {
  return {
    setSelectedAspectRatio: state.setSelectedAspectRatio,
    setDisplayMode: state.setDisplayMode,
    setBrightness: state.setBrightness,
    setBackgroundParticlesIntensity: state.setBackgroundParticlesIntensity,
    setBackgroundGlowIntensity: state.setBackgroundGlowIntensity,
    setMasterVolume: state.setMasterVolume,
    setMusicVolume: state.setMusicVolume,
    setSfxVolume: state.setSfxVolume,
    setMuteInBackground: state.setMuteInBackground,
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

export function useSelectedAspectRatio(): AspectRatioOption {
  return useSettingsStore((s) => s.selectedAspectRatio);
}
