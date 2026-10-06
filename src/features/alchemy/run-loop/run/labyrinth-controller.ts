import { bindSessionCapabilities } from "@/features/alchemy/shared/stores/session-capabilities";
import { enterRunRoom, type RunRoomEntered } from "./room-entry-commands";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
  snapshotTransactionValue,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  completeRunRoom,
  createDraftRunRandomSource,
  setActiveLabyrinthPendingNode,
  setLabyrinthMap,
  setSelectedLabyrinthNodeId,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { expandBeyondBoss } from "@/lib/content-systems/labyrinth/map-generation";
import {
  canDescendFromLabyrinthNode,
  canInspectLabyrinthNode,
  withClearedNode,
} from "@/lib/content-systems/labyrinth/map-state";
import { logError } from "@/lib/error-logger";
export interface LabyrinthController {
  selectNode: (nodeId: string) => void;
  deselectNode: () => void;
  enterSelectedNode: () => RunRoomEntered | null;
  descend: () => void;
  onNodeCleared: () => void;
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
  const onNodeCleared = () => {
    const pending = dispatchRunSessionCommand(
      (draft) => {
        const pendingNode = draft.session.activeLabyrinthPendingNode;
        if (pendingNode) completeRunRoom(draft);
        setActiveLabyrinthPendingNode(draft, null);
        setSelectedLabyrinthNodeId(draft, null);
        if (pendingNode) {
          const prev = draft.session.labyrinthMap;
          if (prev) setLabyrinthMap(draft, withClearedNode(snapshotTransactionValue(prev), pendingNode));
        }
        return acceptCommand(pendingNode);
      },
      undefined,
      gameSession,
    );
    // The pending node is set in enterSelectedNode and cleared here; a clear
    // with nothing pending means a node handler navigated without ever
    // clearing (or a double-clear), so log rather than silently ignoring.
    if (!pending) {
      logError("[createLabyrinthController] onNodeCleared called without a pending node", "other");
    }
  };
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
          expandBeyondBoss(snapshotTransactionValue(map), nodeId, createDraftRunRandomSource(draft, "world")),
        );
        setSelectedLabyrinthNodeId(draft, null);

        return acceptCommand();
      },
      undefined,
      gameSession,
    );
  };
  return bindSessionCapabilities(gameSession, { selectNode, deselectNode, enterSelectedNode, descend, onNodeCleared });
}
