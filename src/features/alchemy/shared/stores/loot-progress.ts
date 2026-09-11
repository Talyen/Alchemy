import { campaignLootDepth, createLootProgress, labyrinthLootDepth, type LootProgress } from "@/lib/loot";
import type { GameplayDraft } from "./run-session-command";

export function resolveDraftLootProgress(draft: GameplayDraft): LootProgress {
  const run = draft.run.activeRun;
  const depth =
    run.contentSystemType === "labyrinth"
      ? labyrinthLootDepth(draft.session.labyrinthMap, draft.session.activeLabyrinthPendingNode)
      : run.contentSystemType === "wildwood"
        ? Math.max(1, run.roomsEncountered)
        : campaignLootDepth(
            run.currentAct,
            run.destinationIndexInAct + (draft.session.rewardFlow.claim.kind === "destination" ? 1 : 0),
          );
  return createLootProgress(depth, draft.profile.completedDifficulties);
}
