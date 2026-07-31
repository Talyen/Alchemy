import type { KeywordId, TalentXP, UnlockedTalents } from "@/lib/game-data";
import type { PermanentProgressFields } from "./run-state-init";
import type { HomesteadProfileActions } from "./slices/progress-homestead-actions";
import type { TalentActions } from "./gameplay-state-store";
import { createSliceStore } from "./slice-store-adapter";
import { createInitialPermanentFields } from "./run-state-init";
import type { GameplayState } from "./gameplay-state-store";

export interface RunProfileActions extends HomesteadProfileActions, TalentActions {
  unlockTalent: (keywordId: KeywordId, talentId: string) => void;
  unlockAllTalents: () => void;
  resetUnlockedTalents: () => void;
  clearPermanentData: () => void;
  applyTalentState: (talentXP: TalentXP, unlockedTalents: UnlockedTalents) => void;
  mergeRunTalentXPIntoProfile: (runTalentXP: TalentXP, multiplier: number) => TalentXP;
}

export type RunProfileStore = PermanentProgressFields & RunProfileActions;

const PROFILE_KEYS = [
  "talentXP",
  "unlockedTalents",
  "materialInventory",
  "constructedBuildings",
  "plantedFarms",
  "completedResearch",
  "bondedCompanions",
  "effects",
  "addMaterials",
  "setMaterials",
  "constructBuilding",
  "plantFarm",
  "completeResearch",
  "bondCompanion",
  "unlockTalent",
  "unlockAllTalents",
  "resetUnlockedTalents",
  "clearPermanentData",
  "applyTalentState",
  "mergeRunTalentXPIntoProfile",
] as const satisfies ReadonlyArray<keyof RunProfileStore>;

const runProfileActionKeys = new Set<string>([
  "addMaterials",
  "setMaterials",
  "constructBuilding",
  "plantFarm",
  "completeResearch",
  "bondCompanion",
  "unlockTalent",
  "unlockAllTalents",
  "resetUnlockedTalents",
  "clearPermanentData",
  "applyTalentState",
  "mergeRunTalentXPIntoProfile",
]);

function pickRunProfileStore(state: GameplayState): RunProfileStore {
  return { ...state.runProfile, ...state.runProfileActions };
}

function writeRunProfileKey(state: GameplayState, key: keyof RunProfileStore, value: unknown): void {
  if (runProfileActionKeys.has(String(key))) {
    (state.runProfileActions as unknown as Record<string, unknown>)[String(key)] = value;
    return;
  }
  (state.runProfile as unknown as Record<string, unknown>)[String(key)] = value;
}

export const useRunProfileStore = createSliceStore<RunProfileStore>(
  pickRunProfileStore,
  PROFILE_KEYS,
  {},
  writeRunProfileKey,
);

export function getRunProfileStore(): RunProfileStore {
  return useRunProfileStore.getState();
}

export function resetRunProfileStore(): void {
  useRunProfileStore.setState(createInitialPermanentFields(), false);
}
