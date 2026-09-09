import { computeHomesteadEffects } from "@/lib/homestead/effects";
import { pruneUnknownCompanions } from "@/features/alchemy/shared/stores/homestead-actions";
import {
  createInitialPermanentFields,
  type PermanentProgressFields,
} from "@/features/alchemy/shared/stores/run-state-init";
import { rebindLiveRunMeta } from "@/features/alchemy/shared/stores/run-meta-rebind";
import { type GameplayPersistenceCodec } from "./persistence-codec";
import { readGameplayState } from "./gameplay-state-store";

export type RunProfileSaveFields = Omit<PermanentProgressFields, "effects">;

type RunProfileSnapshot = PermanentProgressFields;

function encodeRunProfileSnapshot(snapshot: RunProfileSnapshot): RunProfileSaveFields {
  const { effects: _, ...saveFields } = snapshot;
  return saveFields;
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
    const prunedCompanions = pruneUnknownCompanions({ ...fields.bondedCompanions });
    draft.runProfile = {
      ...fields,
      bondedCompanions: prunedCompanions,
      effects: computeHomesteadEffects(
        fields.constructedBuildings,
        fields.plantedFarms,
        fields.completedResearch,
        prunedCompanions,
      ),
    };
    rebindLiveRunMeta(draft);
  },
};
