import { createNotificationChannel } from "./notification-channel";
import { createDefaultSettingsSaveFields, type SettingsSaveFields } from "@/lib/validation";
export { createDefaultSettingsSaveFields, type SettingsSaveFields } from "@/lib/validation";
import {
  clampBrightnessPct,
  clampSpecialEffectsPct,
  clampVolumePct,
  resolveAutoplayEnabled,
} from "@/lib/settings-values";
import { createStore } from "zustand/vanilla";
import { logError } from "@/lib/error-logger";

export type SettingsActions = {
  [K in keyof SettingsSaveFields as `set${Capitalize<K>}`]: (value: SettingsSaveFields[K]) => void;
} & { resetToDefaults: () => void };

export type SettingsStore = SettingsSaveFields & SettingsActions;

export function preferredAutoplayEnabled(fields: {
  rememberAutoplayPreference: boolean;
  autoplayEnabled: boolean;
}): boolean {
  return resolveAutoplayEnabled(fields);
}

// Live writes clamp through the shared settings-values helpers (the same
// ranges the save schema enforces on load), so in-memory state can never hold
// an out-of-range value that load would silently repair.
export function createSettingsStore(
  isActive: () => boolean = () => true,
  track: (cleanup: () => void) => () => void = (cleanup) => cleanup,
  beforeChangeNotification: () => void = () => {},
) {
  const assertActive = () => {
    if (!isActive()) throw new Error("Game session is disposed or invalid");
  };
  const store = createStore<SettingsStore>()((publish) => {
    const set = (change: Partial<SettingsStore> | ((state: SettingsStore) => Partial<SettingsStore>)) => {
      assertActive();
      // Settings actions always merge a field patch; replacement stays private.
      publish(change);
    };
    return {
      ...createDefaultSettingsSaveFields(),

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
      setAutoEquip: (autoEquip) => set({ autoEquip }),
      setRememberAutoplayPreference: (rememberAutoplayPreference) =>
        set((state) => ({
          rememberAutoplayPreference,
          // Intentional: turning remember off clears the stored autoplay choice
          // (pinned by profile-settings-stores test), it does not pause it.
          autoplayEnabled: rememberAutoplayPreference ? state.autoplayEnabled : false,
        })),
      setAutoplayEnabled: (autoplayEnabled) => set({ autoplayEnabled }),
      resetToDefaults: () => set({ ...createDefaultSettingsSaveFields() }),
    };
  });
  type Listener = (state: SettingsStore, previous: SettingsStore) => void;
  const notifications = createNotificationChannel<[...Parameters<Listener>, liveChange: boolean]>((error) => {
    logError("Settings subscriber failed", "other", undefined, undefined, undefined, error);
  }, isActive);
  let installing = false;
  const notify = notifications.publish;
  const savedKeys = Object.keys(createDefaultSettingsSaveFields()) as Array<keyof SettingsSaveFields>;
  // Run inside the FIFO channel: progress observers can themselves change
  // settings, and those later publications must not overtake the original one.
  notifications.subscribe((state, previous, liveChange) => {
    if (liveChange && savedKeys.some((key) => !Object.is(state[key], previous[key]))) beforeChangeNotification();
  });
  Object.freeze(store.getState());
  store.subscribe((state, previous) => {
    Object.freeze(state);
    if (!installing) notify(state, previous, true);
  });
  return {
    getState: () => {
      assertActive();
      return store.getState();
    },
    getInitialState: () => {
      assertActive();
      return store.getInitialState();
    },
    subscribe: (listener: Listener) => {
      assertActive();
      return track(notifications.subscribe(listener));
    },
    // Restore installs both stores and arms save protection before either
    // store's subscribers can snapshot or render the replacement.
    commitHydration(fields: SettingsSaveFields, prepareObservers: () => void) {
      assertActive();
      const previous = store.getState();
      installing = true;
      try {
        store.setState(fields);
      } finally {
        installing = false;
      }
      prepareObservers();
      notify(store.getState(), previous, false);
    },
  };
}
