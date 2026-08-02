// Stable action-only selectors for render paths (functions do not change between store updates).
import { useShallow } from "zustand/react/shallow";
import { useSettingsStore, type SettingsStore } from "./settings-store";
import { useGameplayStateStore } from "./gameplay-state-store";
import type { ProfileStore } from "./profile-store";
import { bondCompanion, completeResearch, constructBuilding, plantFarm } from "./run-session-write-port";

const settingsActionKeys = [
  "setSelectedAspectRatio",
  "setDisplayMode",
  "setBrightness",
  "setMasterVol",
  "setMusicVol",
  "setSfxVol",
  "setMuteInBackground",
  "setAutoEndTurn",
  "setShowClearSaveConfirm",
  "resetToDefaults",
] as const;

const collectionActionKeys = ["setCollectionPage", "handleCollectionTabChange"] as const;

export type SettingsActions = Pick<SettingsStore, (typeof settingsActionKeys)[number]>;
export type CollectionActions = Pick<ProfileStore, (typeof collectionActionKeys)[number]>;

function pickActions<T extends object, K extends keyof T>(state: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) {
    out[key] = state[key];
  }
  return out;
}

function selectSettingsActions(state: SettingsStore): SettingsActions {
  return pickActions(state, settingsActionKeys);
}

export function useSettingsActions(): SettingsActions {
  return useSettingsStore(useShallow(selectSettingsActions));
}

export function useCollectionActions(): CollectionActions {
  return useGameplayStateStore(
    useShallow((state) => pickActions({ ...state.profile, ...state.profileActions }, collectionActionKeys)),
  );
}

export function useHomesteadActions() {
  return {
    constructBuilding,
    plantFarm,
    completeResearch,
    bondCompanion,
  } as const;
}

export interface AppSettings {
  selectedAspectRatio: SettingsStore["selectedAspectRatio"];
  displayMode: SettingsStore["displayMode"];
  brightness: SettingsStore["brightness"];
  musicVol: SettingsStore["musicVol"];
  sfxVol: SettingsStore["sfxVol"];
  masterVol: SettingsStore["masterVol"];
  muteInBackground: SettingsStore["muteInBackground"];
  autoEndTurn: SettingsStore["autoEndTurn"];
}

function selectAppSettings(state: SettingsStore): AppSettings {
  return {
    selectedAspectRatio: state.selectedAspectRatio,
    displayMode: state.displayMode,
    brightness: state.brightness,
    musicVol: state.musicVol,
    sfxVol: state.sfxVol,
    masterVol: state.masterVol,
    muteInBackground: state.muteInBackground,
    autoEndTurn: state.autoEndTurn,
  };
}

export function useAppSettings(): AppSettings {
  return useSettingsStore(useShallow(selectAppSettings));
}
