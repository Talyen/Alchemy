// Stable action-only selectors for render paths (functions do not change between store updates).
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "./app-store";
import { useHomesteadStore } from "./homestead-store";

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

const homesteadActionKeys = ["constructBuilding", "plantFarm", "completeResearch", "bondCompanion"] as const;

export type AppStoreActions = Pick<ReturnType<typeof useAppStore.getState>, (typeof appActionKeys)[number]>;

export type HomesteadStoreActions = Pick<
  ReturnType<typeof useHomesteadStore.getState>,
  (typeof homesteadActionKeys)[number]
>;

function pickActions<T extends Record<string, unknown>, K extends keyof T>(state: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) {
    out[key] = state[key];
  }
  return out;
}

export function selectAppActions(state: ReturnType<typeof useAppStore.getState>): AppStoreActions {
  return pickActions(state, appActionKeys);
}

export function selectHomesteadActions(state: ReturnType<typeof useHomesteadStore.getState>): HomesteadStoreActions {
  return pickActions(state, homesteadActionKeys);
}

export function useAppActions(): AppStoreActions {
  return useAppStore(useShallow(selectAppActions));
}

export function useHomesteadActions(): HomesteadStoreActions {
  return useHomesteadStore(useShallow(selectHomesteadActions));
}
