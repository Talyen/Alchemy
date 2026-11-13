import { snapshotTransactionValue } from "@/features/alchemy/shared/stores/commands/run-session-command";
import { campaignLootDepth, createLootProgress, labyrinthLootDepth, type LootProgress } from "@/lib/loot";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import type { RunTransaction } from "./run-session-command";

function resolveDraftLootDepth(draft: RunTransaction): number {
  const run = draft.run.activeRun;
  switch (run.contentSystemType) {
    case CONTENT_SYSTEMS.LABYRINTH:
      return labyrinthLootDepth(
        snapshotTransactionValue(draft.session.labyrinthMap),
        draft.session.activeLabyrinthPendingNode,
      );
    case CONTENT_SYSTEMS.WILDWOOD:
      return run.roomsEncountered;
    case CONTENT_SYSTEMS.CAMPAIGN:
      return campaignLootDepth(
        run.currentAct,
        run.destinationIndexInAct + (draft.session.progressClaim.kind === "destination" ? 1 : 0),
      );
    default: {
      const exhaustive: never = run.contentSystemType;
      throw new Error(`Unhandled content system for loot progress: ${String(exhaustive)}`);
    }
  }
}

export function resolveDraftLootProgress(draft: RunTransaction): LootProgress {
  return createLootProgress(resolveDraftLootDepth(draft), draft.profile.completedDifficulties);
}
