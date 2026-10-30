import { useMemo } from "react";
import { getRunCompanionDescriptionLines, type RunCompanionInspectionState } from "@/lib/battle";
import { companionLibrary, type CompanionId } from "@/lib/game-data";

export function useRunCompanionDescriptionContext(state: RunCompanionInspectionState) {
  return useMemo(
    () => ({
      describeCompanion: (id: CompanionId) => getRunCompanionDescriptionLines(companionLibrary[id], state),
    }),
    [state],
  );
}
