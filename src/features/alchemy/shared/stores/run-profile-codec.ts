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

const RUN_PROFILE_SAVE_KEYS = Object.keys(createInitialPermanentFields()).filter((key) => key !== "effects") as Array<
  keyof RunProfileSaveFields
>;

function encodeRunProfileSnapshot(snapshot: RunProfileSaveFields): RunProfileSaveFields {
  return Object.fromEntries(RUN_PROFILE_SAVE_KEYS.map((key) => [key, snapshot[key]])) as RunProfileSaveFields;
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
      ...encodeRunProfileSnapshot(fields),
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
