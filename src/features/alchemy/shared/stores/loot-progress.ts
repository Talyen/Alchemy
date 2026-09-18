import { campaignLootDepth, createLootProgress, labyrinthLootDepth, type LootProgress } from "@/lib/loot";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import type { GameplayDraft } from "./run-session-command";

export function resolveDraftLootProgress(draft: GameplayDraft): LootProgress {
  const run = draft.run.activeRun;
  switch (run.contentSystemType) {
    case CONTENT_SYSTEMS.LABYRINTH:
      return createLootProgress(
        labyrinthLootDepth(draft.session.labyrinthMap, draft.session.activeLabyrinthPendingNode),
        draft.profile.completedDifficulties,
      );
    case CONTENT_SYSTEMS.WILDWOOD:
      return createLootProgress(Math.max(1, run.roomsEncountered), draft.profile.completedDifficulties);
    case CONTENT_SYSTEMS.CAMPAIGN:
      return createLootProgress(
        campaignLootDepth(
          run.currentAct,
          run.destinationIndexInAct + (draft.session.rewardFlow.claim.kind === "destination" ? 1 : 0),
        ),
        draft.profile.completedDifficulties,
      );
    default: {
      const exhaustive: never = run.contentSystemType;
      throw new Error(`Unhandled content system for loot progress: ${String(exhaustive)}`);
    }
  }
}
