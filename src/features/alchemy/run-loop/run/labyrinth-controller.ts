import { bindSessionCapabilities } from "@/features/alchemy/shared/stores/session/session-capabilities";
import { enterRunRoom, type RunRoomEntered } from "./room-entry-commands";
import { type GameSession } from "@/features/alchemy/shared/stores/session/game-session-types";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
  snapshotTransactionValue,
} from "@/features/alchemy/shared/stores/commands/run-session-command";
import {
  createDraftRunRandomSource,
  setLabyrinthMap,
  setSelectedLabyrinthNodeId,
} from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { expandBeyondBoss } from "@/lib/content-systems/labyrinth/map-generation";
import { canDescendFromLabyrinthNode, canInspectLabyrinthNode } from "@/lib/content-systems/labyrinth/map-state";
export interface LabyrinthController {
  selectNode: (nodeId: string) => void;
  deselectNode: () => void;
  enterSelectedNode: () => RunRoomEntered | null;
  descend: () => void;
}
export function createLabyrinthController(gameSession: GameSession): LabyrinthController {
  const selectNode = (nodeId: string) => {
    dispatchRunSessionCommand(
      (draft) => {
        const map = draft.session.labyrinthMap;
        setSelectedLabyrinthNodeId(
          draft,
          map && canInspectLabyrinthNode(snapshotTransactionValue(map), nodeId) ? nodeId : null,
        );

        return acceptCommand();
      },
      undefined,
      gameSession,
    );
  };
  const deselectNode = () => {
    dispatchRunSessionCommand(
      (draft) => acceptCommand(setSelectedLabyrinthNodeId(draft, null)),
      undefined,
      gameSession,
    );
  };
  const enterSelectedNode = () => enterRunRoom({ kind: "labyrinth" }, gameSession);
  const descend = () => {
    dispatchRunSessionCommand(
      (draft) => {
        const { labyrinthMap: map, selectedLabyrinthNodeId: nodeId, activeLabyrinthPendingNode } = draft.session;
        if (
          !map ||
          !nodeId ||
          activeLabyrinthPendingNode ||
          !canDescendFromLabyrinthNode(snapshotTransactionValue(map), nodeId)
        )
          return rejectCommand("Labyrinth descent is unavailable", undefined);
        setLabyrinthMap(
          draft,
          expandBeyondBoss(
            snapshotTransactionValue(map),
            nodeId,
            createDraftRunRandomSource(draft, "world"),
            snapshotTransactionValue(draft.run.activeRun.runDeck),
          ),
        );
        setSelectedLabyrinthNodeId(draft, null);

        return acceptCommand();
      },
      undefined,
      gameSession,
    );
  };
  return bindSessionCapabilities(gameSession, { selectNode, deselectNode, enterSelectedNode, descend });
}
