import { useShallow } from "zustand/react/shallow";
import { useSettingsStore, type SettingsStore } from "./settings-store";
import {
  bondCompanion,
  completeResearch,
  constructBuilding,
  handleCollectionTabChange,
  plantFarm,
  setCollectionPage,
} from "./run-session-write-port";
import { createRunSessionCommand } from "./run-session-command";

const commandConstructBuilding = createRunSessionCommand(constructBuilding);
const commandPlantFarm = createRunSessionCommand(plantFarm);
const commandCompleteResearch = createRunSessionCommand(completeResearch);
const commandBondCompanion = createRunSessionCommand(bondCompanion);

export interface CollectionActions {
  setCollectionPage: (tab: Parameters<typeof setCollectionPage>[1], page: number) => void;
  handleCollectionTabChange: (tab: Parameters<typeof handleCollectionTabChange>[1]) => void;
}

const collectionActions: CollectionActions = {
  setCollectionPage: createRunSessionCommand(setCollectionPage),
  handleCollectionTabChange: createRunSessionCommand(handleCollectionTabChange),
};

const settingsActionKeys = [
  "setSelectedAspectRatio",
  "setDisplayMode",
  "setBrightness",
  "setMasterVolume",
  "setMusicVolume",
  "setSfxVolume",
  "setMuteInBackground",
  "setAutoEndTurn",
  "setRememberAutoplayPreference",
  "setAutoplayEnabled",
  "setShowClearSaveConfirm",
  "resetToDefaults",
] as const;

export type SettingsActions = Pick<SettingsStore, (typeof settingsActionKeys)[number]>;

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
  return collectionActions;
}

export interface HomesteadActions {
  constructBuilding: typeof commandConstructBuilding;
  plantFarm: typeof commandPlantFarm;
  completeResearch: typeof commandCompleteResearch;
  bondCompanion: typeof commandBondCompanion;
}

const homesteadActions: HomesteadActions = {
  constructBuilding: commandConstructBuilding,
  plantFarm: commandPlantFarm,
  completeResearch: commandCompleteResearch,
  bondCompanion: commandBondCompanion,
};

export function useHomesteadActions(): HomesteadActions {
  return homesteadActions;
}

export interface AppSettings {
  selectedAspectRatio: SettingsStore["selectedAspectRatio"];
  displayMode: SettingsStore["displayMode"];
  brightness: SettingsStore["brightness"];
  musicVolume: SettingsStore["musicVolume"];
  sfxVolume: SettingsStore["sfxVolume"];
  masterVolume: SettingsStore["masterVolume"];
  muteInBackground: SettingsStore["muteInBackground"];
  autoEndTurn: SettingsStore["autoEndTurn"];
  rememberAutoplayPreference: SettingsStore["rememberAutoplayPreference"];
  autoplayEnabled: SettingsStore["autoplayEnabled"];
}

function selectAppSettings(state: SettingsStore): AppSettings {
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

export function useAppSettings(): AppSettings {
  return useSettingsStore(useShallow(selectAppSettings));
}
