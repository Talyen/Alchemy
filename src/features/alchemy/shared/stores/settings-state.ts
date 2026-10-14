import { createNotificationChannel } from "./notification-channel";
import type { AspectRatioOption, DisplayMode } from "@/features/alchemy/shared/types";
import {
  DEFAULT_BACKGROUND_GLOW_PCT,
  DEFAULT_BACKGROUND_PARTICLES_PCT,
  DEFAULT_BRIGHTNESS_PCT,
  DEFAULT_MASTER_VOLUME_PCT,
  DEFAULT_MUSIC_VOLUME_PCT,
  DEFAULT_SFX_VOLUME_PCT,
} from "@/lib/game-constants";
import {
  clampBrightnessPct,
  clampSpecialEffectsPct,
  clampVolumePct,
  resolveAutoplayEnabled,
} from "@/lib/settings-values";
import { createStore } from "zustand/vanilla";
import { logError } from "@/lib/error-logger";

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
  bossLyricsEnabled: boolean;
  autoEndTurn: boolean;
  rememberAutoplayPreference: boolean;
  autoplayEnabled: boolean;
}

export interface SettingsActions {
  setSelectedAspectRatio: (value: AspectRatioOption) => void;
  setDisplayMode: (value: DisplayMode) => void;
  setBrightness: (value: number) => void;
  setBackgroundParticlesIntensity: (value: number) => void;
  setBackgroundGlowIntensity: (value: number) => void;
  setMusicVolume: (value: number) => void;
  setSfxVolume: (value: number) => void;
  setMasterVolume: (value: number) => void;
  setMuteInBackground: (value: boolean) => void;
  setBossLyricsEnabled: (value: boolean) => void;
  setAutoEndTurn: (value: boolean) => void;
  setRememberAutoplayPreference: (value: boolean) => void;
  setAutoplayEnabled: (value: boolean) => void;
  resetToDefaults: () => void;
}

export type SettingsStore = SettingsSaveFields & SettingsActions;

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
    bossLyricsEnabled: true,
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
export function createSettingsStore() {
  const store = createStore<SettingsStore>()((set) => ({
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
    setBossLyricsEnabled: (bossLyricsEnabled) => set({ bossLyricsEnabled }),
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
  type Listener = (state: SettingsStore, previous: SettingsStore) => void;
  const notifications = createNotificationChannel<Parameters<Listener>>((error) => {
    logError("Settings subscriber failed", "other", undefined, undefined, undefined, error);
  });
  let installing = false;
  const notify = notifications.publish;
  Object.freeze(store.getState());
  store.subscribe((state, previous) => {
    Object.freeze(state);
    if (!installing) notify(state, previous);
  });
  return {
    ...store,
    subscribe: notifications.subscribe,
    // Restore installs both stores and arms save protection before either
    // store's subscribers can snapshot or render the replacement.
    commitHydration(fields: SettingsSaveFields, prepareObservers: () => void) {
      const previous = store.getState();
      installing = true;
      try {
        store.setState(fields);
      } finally {
        installing = false;
      }
      prepareObservers();
      notify(store.getState(), previous);
    },
  };
}

// Defaults own the persisted field list; methods and unrelated save fields never encode.
const SETTINGS_SAVE_KEYS = Object.keys(createDefaultSettingsSaveFields()) as Array<keyof SettingsSaveFields>;

export function selectSettingsSaveFields(state: SettingsSaveFields): SettingsSaveFields {
  const selected = createDefaultSettingsSaveFields();
  for (const key of SETTINGS_SAVE_KEYS) Object.assign(selected, { [key]: state[key] });
  return selected;
}

export function createSettingsPersistenceCodec(store: ReturnType<typeof createSettingsStore>) {
  function prepareHydration(fields: SettingsSaveFields) {
    const selected = selectSettingsSaveFields(fields);
    const normalized = {
      ...selected,
      brightness: clampBrightnessPct(selected.brightness),
      backgroundParticlesIntensity: clampSpecialEffectsPct(selected.backgroundParticlesIntensity),
      backgroundGlowIntensity: clampSpecialEffectsPct(selected.backgroundGlowIntensity),
      musicVolume: clampVolumePct(selected.musicVolume),
      sfxVolume: clampVolumePct(selected.sfxVolume),
      masterVolume: clampVolumePct(selected.masterVolume),
      // Loading with remember off clears a stored autoplay choice.
      autoplayEnabled: resolveAutoplayEnabled(selected),
    };
    return (prepareObservers: () => void = () => {}) => store.commitHydration(normalized, prepareObservers);
  }
  return {
    createDefault: createDefaultSettingsSaveFields,
    // Pure selection: the live invariant is owned by the setters above (which
    // clamp on every write), load repair by SaveDataSchema, and direct-hydrate
    // safety by prepareHydration. Encode adds no further derivation.
    encode: () => selectSettingsSaveFields(store.getState()),
    prepareHydration,
    hydrate: (fields: SettingsSaveFields) => prepareHydration(fields)(),
  };
}
