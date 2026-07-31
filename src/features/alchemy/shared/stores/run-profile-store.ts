import type { KeywordId, TalentXP, UnlockedTalents } from "@/lib/game-data";
import type { PermanentProgressFields } from "./run-state-init";
import type { HomesteadProfileActions } from "./slices/progress-homestead-actions";
import type { TalentActions } from "./gameplay-state-store";
import { createSliceStore } from "./slice-store-adapter";
import { createInitialPermanentFields } from "./run-state-init";

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

export const useRunProfileStore = createSliceStore<RunProfileStore>((state) => state, PROFILE_KEYS);

export function getRunProfileStore(): RunProfileStore {
  return useRunProfileStore.getState();
}

export function resetRunProfileStore(): void {
  useRunProfileStore.setState(createInitialPermanentFields(), false);
}

export function readRunProfileFields(profile: PermanentProgressFields): PermanentProgressFields {
  return {
    talentXP: profile.talentXP,
    unlockedTalents: profile.unlockedTalents,
    materialInventory: profile.materialInventory,
    constructedBuildings: profile.constructedBuildings,
    plantedFarms: profile.plantedFarms,
    completedResearch: profile.completedResearch,
    bondedCompanions: profile.bondedCompanions,
    effects: profile.effects,
  };
}
