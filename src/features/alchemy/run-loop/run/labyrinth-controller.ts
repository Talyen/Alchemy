import { current } from "immer";
import { canEnterLabyrinthNode, expandBeyondBoss } from "@/lib/content-systems/labyrinth/map-generation";
import {
  canDescendFromLabyrinthNode,
  canInspectLabyrinthNode,
  withClearedNode,
} from "@/lib/content-systems/labyrinth/map-state";
import type {
  EncounterCombatTraitId,
  EncounterRewardTraitId,
  LabyrinthNode,
  LabyrinthNodeType,
} from "@/lib/content-systems/types";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  setActiveLabyrinthPendingNode,
  setLabyrinthMap,
  setSelectedLabyrinthNodeId,
} from "@/features/alchemy/shared/stores/run-session-write-port";
export interface LabyrinthController {
  selectNode: (nodeId: string) => void;
  deselectNode: () => void;
  enterSelectedNode: (handlers: LabyrinthNodeHandlers) => boolean;
  descend: () => void;
  onNodeCleared: () => void;
}
export interface LabyrinthNodeHandlers {
  onStartBattleWithModifiers: (
    enemyType: "normal" | "elite",
    modifiers: EncounterCombatTraitId[],
    rewardModifiers: EncounterRewardTraitId[],
    enemyId?: string,
  ) => void;
  onStartBossBattleWithModifiers: (
    modifiers: EncounterCombatTraitId[],
    rewardModifiers: EncounterRewardTraitId[],
    enemyId?: string,
  ) => void;
  onStartRest: (modifiers?: EncounterRewardTraitId[]) => void;
  onStartMystery: (modifiers?: EncounterRewardTraitId[]) => void;
  onStartCorruption: (modifiers?: EncounterRewardTraitId[]) => void;
  onStartShop: (modifiers?: EncounterRewardTraitId[]) => void;
  onStartAlchemist: (modifiers?: EncounterRewardTraitId[]) => void;
  onStartTrinketShop: (modifiers?: EncounterRewardTraitId[]) => void;
  onStartEquipmentShop: (modifiers?: EncounterRewardTraitId[]) => void;
}
type NodeAction = (node: LabyrinthNode, handlers: LabyrinthNodeHandlers) => void;
const NODE_ACTIONS: Record<LabyrinthNodeType, NodeAction> = {
  combat: (node, handlers) =>
    handlers.onStartBattleWithModifiers("normal", node.modifiers, node.rewardModifiers, node.enemyId),
  elite: (node, handlers) =>
    handlers.onStartBattleWithModifiers("elite", node.modifiers, node.rewardModifiers, node.enemyId),
  boss: (node, handlers) => handlers.onStartBossBattleWithModifiers(node.modifiers, node.rewardModifiers, node.enemyId),
  entrance: () => {},
  rest: (node, handlers) => handlers.onStartRest(node.rewardModifiers),
  mystery: (node, handlers) => handlers.onStartMystery(node.rewardModifiers),
  corruption: (node, handlers) => handlers.onStartCorruption(node.rewardModifiers),
  shop: (node, handlers) => handlers.onStartShop(node.rewardModifiers),
  alchemist: (node, handlers) => handlers.onStartAlchemist(node.rewardModifiers),
  "trinket-shop": (node, handlers) => handlers.onStartTrinketShop(node.rewardModifiers),
  "equipment-shop": (node, handlers) => handlers.onStartEquipmentShop(node.rewardModifiers),
};
function routeNodeInteraction(node: LabyrinthNode, handlers: LabyrinthNodeHandlers): void {
  NODE_ACTIONS[node.type](node, handlers);
}
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
  const enterSelectedNode = (handlers: LabyrinthNodeHandlers): boolean => {
    const node = dispatchRunSessionCommand((draft) => {
      const session = draft.session;
      if (session.activeLabyrinthPendingNode) return null;
      const nodeId = session.selectedLabyrinthNodeId;
      if (!nodeId) return null;
      const map = session.labyrinthMap;
      if (!map) return null;
      const node = map.nodes[nodeId];
      if (!node || !canEnterLabyrinthNode(map, nodeId)) return null;
      setActiveLabyrinthPendingNode(draft, nodeId);
      return current(node);
    });
    if (!node) return false;
    try {
      routeNodeInteraction(node, handlers);
    } catch (error) {
      dispatchRunSessionCommand((draft) => setActiveLabyrinthPendingNode(draft, null));
      throw error;
    }
    return true;
  };
  const onNodeCleared = () => {
    const pending = dispatchRunSessionCommand((draft) => {
      const pendingNode = draft.session.activeLabyrinthPendingNode;
      setActiveLabyrinthPendingNode(draft, null);
      setSelectedLabyrinthNodeId(draft, null);
      if (pendingNode) {
        const prev = draft.session.labyrinthMap;
        if (prev) setLabyrinthMap(draft, withClearedNode(prev, pendingNode));
      }
      return pendingNode;
    });
    if (!pending) {
      console.warn("[createLabyrinthController] onNodeCleared called without a pending node");
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
