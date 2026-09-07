import { useCallback, useMemo } from "react";
import { current } from "immer";
import {
  canEnterLabyrinthNode,
  generateLabyrinthMap,
  withClearedLabyrinthNode,
} from "@/lib/content-systems/labyrinth/map-generation";
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
  onNodeCleared: () => void;
  resetMap: () => void;
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
  shop: (node, handlers) => handlers.onStartShop(node.rewardModifiers),
  alchemist: (node, handlers) => handlers.onStartAlchemist(node.rewardModifiers),
  "trinket-shop": (node, handlers) => handlers.onStartTrinketShop(node.rewardModifiers),
  "equipment-shop": (node, handlers) => handlers.onStartEquipmentShop(node.rewardModifiers),
};

function routeNodeInteraction(node: LabyrinthNode, handlers: LabyrinthNodeHandlers): void {
  NODE_ACTIONS[node.type](node, handlers);
}

export function useLabyrinthController(): LabyrinthController {
  const resetMap = useCallback(() => {
    dispatchRunSessionCommand((draft) => {
      setActiveLabyrinthPendingNode(draft, null);
      setSelectedLabyrinthNodeId(draft, null);
      setLabyrinthMap(draft, generateLabyrinthMap(createDraftRunRandomSource(draft, "world")));
    });
  }, []);

  const selectNode = useCallback((nodeId: string) => {
    dispatchRunSessionCommand((draft) => {
      const map = draft.session.labyrinthMap;
      if (!map) return;
      const node = map.nodes[nodeId];
      if (!node || node.cleared) return;
      setSelectedLabyrinthNodeId(draft, nodeId);
    });
  }, []);

  const deselectNode = useCallback(() => {
    dispatchRunSessionCommand((draft) => setSelectedLabyrinthNodeId(draft, null));
  }, []);

  const enterSelectedNode = useCallback((handlers: LabyrinthNodeHandlers): boolean => {
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
  }, []);

  const onNodeCleared = useCallback(() => {
    const pending = dispatchRunSessionCommand((draft) => {
      const pendingNode = draft.session.activeLabyrinthPendingNode;
      setActiveLabyrinthPendingNode(draft, null);
      setSelectedLabyrinthNodeId(draft, null);
      if (pendingNode) {
        const rng = createDraftRunRandomSource(draft, "world");
        const prev = draft.session.labyrinthMap;
        if (prev) setLabyrinthMap(draft, withClearedLabyrinthNode(prev, pendingNode, rng));
      }
      return pendingNode;
    });
    if (!pending) {
      console.warn("[useLabyrinthController] onNodeCleared called without a pending node");
    }
  }, []);

  return useMemo(
    () => ({ selectNode, deselectNode, enterSelectedNode, onNodeCleared, resetMap }),
    [selectNode, deselectNode, enterSelectedNode, onNodeCleared, resetMap],
  );
}
