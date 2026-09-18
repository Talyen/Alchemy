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
import { clamp } from "@/lib/math";
import type { StandalonePersistenceCodec } from "./persistence-codec";
import { resolveAutoplayEnabled, SETTINGS_RANGES } from "@/lib/settings-values";

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
  showClearSaveConfirm: boolean;

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
  setShowClearSaveConfirm: (value: boolean) => void;
  resetToDefaults: () => void;
}

function createDefaultSettingsSaveFields(): SettingsSaveFields {
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

function withDerivedAutoplay<T extends { rememberAutoplayPreference: boolean; autoplayEnabled: boolean }>(
  fields: T,
): T {
  return { ...fields, autoplayEnabled: resolveAutoplayEnabled(fields) };
}

// Live writes clamp to the same ranges the save schema enforces on load (see
// clampedSettingSchema), so in-memory state can never hold an out-of-range
// value that load would silently repair.
function clampVolume(value: number): number {
  return clamp(value, SETTINGS_RANGES.volume.min, SETTINGS_RANGES.volume.max);
}

function clampSpecialEffects(value: number): number {
  return clamp(value, SETTINGS_RANGES.specialEffects.min, SETTINGS_RANGES.specialEffects.max);
}

export const useSettingsStore = create<SettingsStore>()((set) => ({
  ...withDerivedAutoplay(createDefaultSettingsSaveFields()),
  showClearSaveConfirm: false,

  setSelectedAspectRatio: (selectedAspectRatio) => set({ selectedAspectRatio }),
  setDisplayMode: (displayMode) => set({ displayMode }),
  setBrightness: (brightness) =>
    set({ brightness: clamp(brightness, SETTINGS_RANGES.brightness.min, SETTINGS_RANGES.brightness.max) }),
  setBackgroundParticlesIntensity: (backgroundParticlesIntensity) =>
    set({ backgroundParticlesIntensity: clampSpecialEffects(backgroundParticlesIntensity) }),
  setBackgroundGlowIntensity: (backgroundGlowIntensity) =>
    set({ backgroundGlowIntensity: clampSpecialEffects(backgroundGlowIntensity) }),
  setMusicVolume: (musicVolume) => set({ musicVolume: clampVolume(musicVolume) }),
  setSfxVolume: (sfxVolume) => set({ sfxVolume: clampVolume(sfxVolume) }),
  setMasterVolume: (masterVolume) => set({ masterVolume: clampVolume(masterVolume) }),
  setMuteInBackground: (muteInBackground) => set({ muteInBackground }),
  setAutoEndTurn: (autoEndTurn) => set({ autoEndTurn }),
  setRememberAutoplayPreference: (rememberAutoplayPreference) =>
    set((state) => ({
      rememberAutoplayPreference,
      // Intentional: turning remember off clears the stored autoplay choice
      // (pinned by profile-settings-stores test), it does not pause it.
      autoplayEnabled: rememberAutoplayPreference ? state.autoplayEnabled : false,
    })),
  setAutoplayEnabled: (autoplayEnabled) =>
    set((state) =>
      withDerivedAutoplay({
        ...selectSettingsSaveFields(state),
        autoplayEnabled,
      }),
    ),
  setShowClearSaveConfirm: (showClearSaveConfirm) => set({ showClearSaveConfirm }),
  resetToDefaults: () =>
    set({ ...withDerivedAutoplay(createDefaultSettingsSaveFields()), showClearSaveConfirm: false }),
}));

export function selectSettingsSaveFields(state: Pick<SettingsStore, keyof SettingsSaveFields>): SettingsSaveFields {
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
    useSettingsStore.setState(
      withDerivedAutoplay({
        ...selected,
        brightness: clamp(selected.brightness, SETTINGS_RANGES.brightness.min, SETTINGS_RANGES.brightness.max),
        backgroundParticlesIntensity: clampSpecialEffects(selected.backgroundParticlesIntensity),
        backgroundGlowIntensity: clampSpecialEffects(selected.backgroundGlowIntensity),
        musicVolume: clampVolume(selected.musicVolume),
        sfxVolume: clampVolume(selected.sfxVolume),
        masterVolume: clampVolume(selected.masterVolume),
      }),
    );
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
  | "setShowClearSaveConfirm"
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
    setShowClearSaveConfirm: state.setShowClearSaveConfirm,
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
