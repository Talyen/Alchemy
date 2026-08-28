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
  onStartRest: () => void;
  onStartMystery: () => void;
  onStartShop: () => void;
  onStartAlchemist: () => void;
  onStartTrinketShop: () => void;
  onStartEquipmentShop: () => void;
}

type NodeAction = (node: LabyrinthNode, handlers: LabyrinthNodeHandlers) => void;

const NODE_ACTIONS: Record<LabyrinthNodeType, NodeAction> = {
  combat: (node, handlers) =>
    handlers.onStartBattleWithModifiers("normal", node.modifiers, node.rewardModifiers, node.enemyId),
  elite: (node, handlers) =>
    handlers.onStartBattleWithModifiers("elite", node.modifiers, node.rewardModifiers, node.enemyId),
  boss: (node, handlers) => handlers.onStartBossBattleWithModifiers(node.modifiers, node.rewardModifiers, node.enemyId),
  entrance: () => {},
  rest: (_, handlers) => handlers.onStartRest(),
  mystery: (_, handlers) => handlers.onStartMystery(),
  shop: (_, handlers) => handlers.onStartShop(),
  alchemist: (_, handlers) => handlers.onStartAlchemist(),
  "trinket-shop": (_, handlers) => handlers.onStartTrinketShop(),
  "equipment-shop": (_, handlers) => handlers.onStartEquipmentShop(),
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
      const node = draft.session.labyrinthMap.nodes[nodeId];
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
      const node = session.labyrinthMap.nodes[nodeId];
      if (!node || !canEnterLabyrinthNode(session.labyrinthMap, nodeId)) return null;
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
        setLabyrinthMap(draft, (previous) => withClearedLabyrinthNode(previous, pendingNode, rng));
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
