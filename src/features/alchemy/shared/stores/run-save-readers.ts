// Store-owned codec for permanent run-domain progression save fields.
import type { CompanionId, TalentXP, UnlockedTalents } from "@/lib/game-data";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import type { BuildingId, FarmId, MaterialInventory, ResearchId } from "@/lib/homestead/types";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import { createInitialPermanentFields } from "@/features/alchemy/shared/stores/run-state-init";
import type { PersistenceCodec } from "./persistence-codec";
import { createRunSessionStoreSnapshot } from "./run-session-queries";
import { applyGameplayStateUpdate, subscribeGameplayCommits } from "./gameplay-state-store";

export interface RunProfileSaveFields {
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

/** Persistence: permanent homestead + talent fields for save snapshots. */
function readPermanentProgressForSave(): RunProfileSnapshot {
  return createRunSessionStoreSnapshot().runProfile;
}

export const runProfilePersistenceCodec: PersistenceCodec<RunProfileSaveFields> = {
  createDefault: createDefaultRunProfileSaveFields,
  encode: () => encodeRunProfileSnapshot(readPermanentProgressForSave()),
  hydrate: (fields) =>
    applyGameplayStateUpdate((state) => {
      state.runProfile = {
        ...fields,
        effects: computeHomesteadEffects(
          fields.constructedBuildings,
          fields.plantedFarms,
          fields.completedResearch,
          fields.bondedCompanions,
        ),
      };
    }),
  subscribe: (listener) => subscribeGameplayCommits(() => listener()),
};
