// Stable action-only selectors for render paths (functions do not change between store updates).
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "./app-store";
import { getRunDomainStore } from "./run-session-facade";

const appActionKeys = [
  "setSelectedAspectRatio",
  "setDisplayMode",
  "setUiScale",
  "setBrightness",
  "setMasterVol",
  "setMusicVol",
  "setSfxVol",
  "setMuteInBackground",
  "setAutoEndTurn",
  "setShowClearSaveConfirm",
  "setCollectionPage",
  "resetOptionsToDefault",
  "handleCollectionTabChange",
] as const;

export type AppStoreActions = Pick<ReturnType<typeof useAppStore.getState>, (typeof appActionKeys)[number]>;

function pickActions<T extends object, K extends keyof T>(state: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) {
    out[key] = state[key];
  }
  return out;
}

function selectAppActions(state: ReturnType<typeof useAppStore.getState>): AppStoreActions {
  return pickActions(state, appActionKeys);
}

export function useAppActions(): AppStoreActions {
  return useAppStore(useShallow(selectAppActions));
}

export function useHomesteadActions() {
  const store = getRunDomainStore();
  return {
    constructBuilding: store.constructBuilding,
    plantFarm: store.plantFarm,
    completeResearch: store.completeResearch,
    bondCompanion: store.bondCompanion,
  } as const;
}

export interface AppSettings {
  selectedAspectRatio: ReturnType<typeof useAppStore.getState>["selectedAspectRatio"];
  displayMode: ReturnType<typeof useAppStore.getState>["displayMode"];
  uiScale: ReturnType<typeof useAppStore.getState>["uiScale"];
  brightness: ReturnType<typeof useAppStore.getState>["brightness"];
  musicVol: ReturnType<typeof useAppStore.getState>["musicVol"];
  sfxVol: ReturnType<typeof useAppStore.getState>["sfxVol"];
  masterVol: ReturnType<typeof useAppStore.getState>["masterVol"];
  muteInBackground: ReturnType<typeof useAppStore.getState>["muteInBackground"];
  autoEndTurn: ReturnType<typeof useAppStore.getState>["autoEndTurn"];
}

function selectAppSettings(state: ReturnType<typeof useAppStore.getState>): AppSettings {
  return {
    selectedAspectRatio: state.selectedAspectRatio,
    displayMode: state.displayMode,
    uiScale: state.uiScale,
    brightness: state.brightness,
    musicVol: state.musicVol,
    sfxVol: state.sfxVol,
    masterVol: state.masterVol,
    muteInBackground: state.muteInBackground,
    autoEndTurn: state.autoEndTurn,
  };
}

export function useAppSettings(): AppSettings {
  return useAppStore(useShallow(selectAppSettings));
}
