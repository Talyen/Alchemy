import { pruneUnknownCompanions } from "@/features/alchemy/shared/stores/homestead-actions";
import { rebindLiveRunMeta } from "@/features/alchemy/shared/stores/run-session-write-port";
import {
  createInitialPermanentFields,
  type PermanentProgressFields,
} from "@/features/alchemy/shared/stores/run-state-init";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import { defaultGameSession } from "./default-game-session";
import type { GameSession } from "./game-session-types";
import { readGameplayState } from "./gameplay-state-store";
import { type GameplayPersistenceCodec } from "./persistence-codec";
import { RUN_PROFILE_SAVE_KEYS } from "./run-profile-save-fields";

export type RunProfileSaveFields = Omit<PermanentProgressFields, "effects">;

type RunProfileSnapshot = PermanentProgressFields;

export { RUN_PROFILE_SAVE_KEYS } from "./run-profile-save-fields";

function encodeRunProfileSnapshot(snapshot: RunProfileSaveFields): RunProfileSaveFields {
  return Object.fromEntries(RUN_PROFILE_SAVE_KEYS.map((key) => [key, snapshot[key]])) as RunProfileSaveFields;
}

function createDefaultRunProfileSaveFields(): RunProfileSaveFields {
  return encodeRunProfileSnapshot(createInitialPermanentFields());
}

function readPermanentProgressForSave(gameSession: GameSession = defaultGameSession): RunProfileSnapshot {
  return readGameplayState(gameSession).runProfile;
}

export const runProfilePersistenceCodec: GameplayPersistenceCodec<RunProfileSaveFields> = {
  createDefault: createDefaultRunProfileSaveFields,
  encode: (gameSession: GameSession = defaultGameSession) =>
    encodeRunProfileSnapshot(readPermanentProgressForSave(gameSession)),
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
