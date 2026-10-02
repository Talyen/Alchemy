import { DESTINATIONS, type Destination } from "@/lib/routing";
import { current } from "immer";
import { canEnterLabyrinthNode, expandBeyondBoss } from "@/lib/content-systems/labyrinth/map-generation";
import {
  canDescendFromLabyrinthNode,
  canInspectLabyrinthNode,
  withClearedNode,
} from "@/lib/content-systems/labyrinth/map-state";
import type { LabyrinthNode, LabyrinthNodeType } from "@/lib/content-systems/types";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { logError } from "@/lib/error-logger";
import {
  createDraftRunRandomSource,
  setActiveLabyrinthPendingNode,
  setLabyrinthMap,
  setSelectedLabyrinthNodeId,
  recordRunRoom,
  cancelRunRoomEntry,
  completeRunRoom,
} from "@/features/alchemy/shared/stores/run-session-write-port";
export interface LabyrinthController {
  selectNode: (nodeId: string) => void;
  deselectNode: () => void;
  enterSelectedNode: (openRoom: (node: LabyrinthNode) => void) => boolean;
  descend: () => void;
  onNodeCleared: () => void;
}
const ROOM_DESTINATIONS: Record<Exclude<LabyrinthNodeType, "entrance">, Destination> = {
  combat: DESTINATIONS.NORMAL_COMBAT,
  elite: DESTINATIONS.ELITE_COMBAT,
  boss: DESTINATIONS.BOSS_COMBAT,
  rest: DESTINATIONS.CAMPFIRE,
  mystery: DESTINATIONS.MYSTERY,
  corruption: DESTINATIONS.CORRUPTION,
  shop: DESTINATIONS.CARD_SHOP,
  alchemist: DESTINATIONS.ALCHEMIST_SHOP,
  "trinket-shop": DESTINATIONS.TRINKET_SHOP,
  "equipment-shop": DESTINATIONS.GEAR_SHOP,
};
export function createLabyrinthController(): LabyrinthController {
  const selectNode = (nodeId: string) => {
    dispatchRunSessionCommand((draft) => {
      const map = draft.session.labyrinthMap;
      setSelectedLabyrinthNodeId(draft, map && canInspectLabyrinthNode(map, nodeId) ? nodeId : null);
    });
  };
  const deselectNode = () => {
    dispatchRunSessionCommand((draft) => setSelectedLabyrinthNodeId(draft, null));
  };
  const enterSelectedNode = (openRoom: (node: LabyrinthNode) => void): boolean => {
    const entry = dispatchRunSessionCommand((draft) => {
      const session = draft.session;
      if (session.activeLabyrinthPendingNode) return null;
      const nodeId = session.selectedLabyrinthNodeId;
      if (!nodeId) return null;
      const map = session.labyrinthMap;
      if (!map) return null;
      const node = map.nodes[nodeId];
      if (!node || !canEnterLabyrinthNode(map, nodeId)) return null;
      setActiveLabyrinthPendingNode(draft, nodeId);
      const visitId = `labyrinth:${map.currentFloor}:${nodeId}`;
      const recorded = node.type !== "entrance" && recordRunRoom(draft, ROOM_DESTINATIONS[node.type], visitId);
      return { node: current(node), visitId, recorded };
    });
    if (!entry) return false;
    try {
      openRoom(entry.node);
    } catch (error) {
      dispatchRunSessionCommand((draft) => {
        setActiveLabyrinthPendingNode(draft, null);
        if (entry.recorded) cancelRunRoomEntry(draft, entry.visitId);
      });
      throw error;
    }
    return true;
  };
  const onNodeCleared = () => {
    const pending = dispatchRunSessionCommand((draft) => {
      const pendingNode = draft.session.activeLabyrinthPendingNode;
      if (pendingNode) completeRunRoom(draft);
      setActiveLabyrinthPendingNode(draft, null);
      setSelectedLabyrinthNodeId(draft, null);
      if (pendingNode) {
        const prev = draft.session.labyrinthMap;
        if (prev) setLabyrinthMap(draft, withClearedNode(prev, pendingNode));
      }
      return pendingNode;
    });
    // The pending node is set in enterSelectedNode and cleared here; a clear
    // with nothing pending means a node handler navigated without ever
    // clearing (or a double-clear), so log rather than silently ignoring.
    if (!pending) {
      logError("[createLabyrinthController] onNodeCleared called without a pending node", "other");
    }
  };
  const descend = () => {
    dispatchRunSessionCommand((draft) => {
      const { labyrinthMap: map, selectedLabyrinthNodeId: nodeId, activeLabyrinthPendingNode } = draft.session;
      if (!map || !nodeId || activeLabyrinthPendingNode || !canDescendFromLabyrinthNode(map, nodeId)) return;
      setLabyrinthMap(draft, expandBeyondBoss(map, nodeId, createDraftRunRandomSource(draft, "world")));
      setSelectedLabyrinthNodeId(draft, null);
    });
  };
  return { selectNode, deselectNode, enterSelectedNode, descend, onNodeCleared };
}
