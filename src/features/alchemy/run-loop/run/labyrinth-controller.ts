import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
  snapshotTransactionValue,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  cancelRunRoomEntry,
  completeRunRoom,
  createDraftRunRandomSource,
  recordRunRoom,
  setActiveLabyrinthPendingNode,
  setLabyrinthMap,
  setSelectedLabyrinthNodeId,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { LABYRINTH_TYPE_TO_DESTINATION } from "@/lib/content-systems/labyrinth/data";
import { canEnterLabyrinthNode, expandBeyondBoss } from "@/lib/content-systems/labyrinth/map-generation";
import {
  canDescendFromLabyrinthNode,
  canInspectLabyrinthNode,
  withClearedNode,
} from "@/lib/content-systems/labyrinth/map-state";
import type { LabyrinthNode } from "@/lib/content-systems/types";
import { logError } from "@/lib/error-logger";
export interface LabyrinthController {
  selectNode: (nodeId: string) => void;
  deselectNode: () => void;
  enterSelectedNode: (openRoom: (node: LabyrinthNode) => void) => boolean;
  descend: () => void;
  onNodeCleared: () => void;
}
export function createLabyrinthController(gameSession: GameSession = defaultGameSession): LabyrinthController {
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
  const enterSelectedNode = (openRoom: (node: LabyrinthNode) => void): boolean => {
    const entry = dispatchRunSessionCommand(
      (draft) => {
        const session = draft.session;
        if (session.activeLabyrinthPendingNode) return rejectCommand("Labyrinth node is unavailable", null);
        const nodeId = session.selectedLabyrinthNodeId;
        if (!nodeId) return rejectCommand("Labyrinth node is unavailable", null);
        const map = session.labyrinthMap;
        if (!map) return rejectCommand("Labyrinth node is unavailable", null);
        const node = map.nodes[nodeId];
        if (!node || !canEnterLabyrinthNode(snapshotTransactionValue(map), nodeId))
          return rejectCommand("Labyrinth node is unavailable", null);
        setActiveLabyrinthPendingNode(draft, nodeId);
        const visitId = `labyrinth:${map.currentFloor}:${nodeId}`;
        const recorded =
          node.type !== "entrance" && recordRunRoom(draft, LABYRINTH_TYPE_TO_DESTINATION[node.type], visitId);
        return acceptCommand({ node: snapshotTransactionValue(node), visitId, recorded });
      },
      undefined,
      gameSession,
    );
    if (!entry) return false;
    try {
      openRoom(entry.node);
    } catch (error) {
      dispatchRunSessionCommand(
        (draft) => {
          setActiveLabyrinthPendingNode(draft, null);
          if (entry.recorded) cancelRunRoomEntry(draft, entry.visitId);

          return acceptCommand();
        },
        undefined,
        gameSession,
      );
      throw error;
    }
    return true;
  };
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
  return { selectNode, deselectNode, enterSelectedNode, descend, onNodeCleared };
}
