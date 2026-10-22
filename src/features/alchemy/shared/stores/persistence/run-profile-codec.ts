import { pruneUnknownCompanions } from "@/features/alchemy/shared/stores/commands/homestead-actions";
import { rebindLiveRunMeta } from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { createInitialPermanentFields } from "@/features/alchemy/shared/stores/session/run-state-init";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import type { GameSession } from "../session/game-session-types";
import { readGameplayState } from "../session/gameplay-state-reads";
import { type GameplayPersistenceCodec } from "./persistence-codec";
import { RUN_PROFILE_SAVE_KEYS, type RunProfileSaveFields } from "./run-profile-save-fields";
export type { RunProfileSaveFields } from "./run-profile-save-fields";

function encodeRunProfileSnapshot(snapshot: RunProfileSaveFields): RunProfileSaveFields {
  // Both restore input and standalone encoded fields cross an ownership boundary.
  return structuredClone(
    Object.fromEntries(RUN_PROFILE_SAVE_KEYS.map((key) => [key, snapshot[key]])),
  ) as RunProfileSaveFields;
}

function createDefaultRunProfileSaveFields(): RunProfileSaveFields {
  return encodeRunProfileSnapshot(createInitialPermanentFields());
}

export const runProfilePersistenceCodec: GameplayPersistenceCodec<RunProfileSaveFields> = {
  createDefault: createDefaultRunProfileSaveFields,
  encode: (gameSession: GameSession) => encodeRunProfileSnapshot(readGameplayState(gameSession).runProfile),
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
