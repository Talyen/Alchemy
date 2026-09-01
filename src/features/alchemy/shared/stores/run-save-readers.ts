import type { CompanionId, TalentXP, UnlockedTalents } from "@/lib/game-data";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import type { BuildingId, FarmId, MaterialInventory, ResearchId } from "@/lib/homestead/types";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import { createInitialPermanentFields } from "@/features/alchemy/shared/stores/run-state-init";
import { type GameplayPersistenceCodec } from "./persistence-codec";
import { readGameplayState } from "./gameplay-state-store";

export interface RunProfileSaveFields {
  gold: number;
  talentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
  materialInventory: MaterialInventory;
  constructedBuildings: Record<BuildingId, number>;
  plantedFarms: Record<FarmId, number>;
  completedResearch: Record<ResearchId, number>;
  bondedCompanions: Record<CompanionId, number>;
}

type RunProfileSnapshot = RunProfileSaveFields & {
  effects: HomesteadEffectManifest;
};

function encodeRunProfileSnapshot(snapshot: RunProfileSnapshot): RunProfileSaveFields {
  return {
    gold: snapshot.gold,
    talentXP: snapshot.talentXP,
    unlockedTalents: snapshot.unlockedTalents,
    materialInventory: snapshot.materialInventory,
    constructedBuildings: snapshot.constructedBuildings,
    plantedFarms: snapshot.plantedFarms,
    completedResearch: snapshot.completedResearch,
    bondedCompanions: snapshot.bondedCompanions,
  };
}

function createDefaultRunProfileSaveFields(): RunProfileSaveFields {
  return encodeRunProfileSnapshot(createInitialPermanentFields());
}

function readPermanentProgressForSave(): RunProfileSnapshot {
  return readGameplayState().runProfile;
}

export const runProfilePersistenceCodec: GameplayPersistenceCodec<RunProfileSaveFields> = {
  createDefault: createDefaultRunProfileSaveFields,
  encode: () => encodeRunProfileSnapshot(readPermanentProgressForSave()),
  hydrate: (fields, draft) => {
    const next = {
      ...fields,
      effects: computeHomesteadEffects(
        fields.constructedBuildings,
        fields.plantedFarms,
        fields.completedResearch,
        fields.bondedCompanions,
      ),
    };
    draft.runProfile = next;
  },
};
