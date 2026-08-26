/**
 * Hook for managing Labyrinth map navigation, state mutations, and node entry.
 */

import { useCallback, useMemo } from "react";
import { current } from "immer";
import {
  canEnterLabyrinthNode,
  withCurrentNode,
  withFailedNode,
  generateLabyrinthMap,
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
} from "@/features/alchemy/shared/stores/run-session-write-port";

export interface LabyrinthController {
  enterNode: (row: number, col: number, handlers: LabyrinthNodeHandlers) => boolean;
  onNodeCleared: () => void;
  onNodeFailed: () => void;
  resetMap: () => void;
}

export interface LabyrinthNodeHandlers {
  onStartBattleWithModifiers: (
    enemyType: "normal" | "elite",
    modifiers: EncounterCombatTraitId[],
    rewardModifiers: EncounterRewardTraitId[],
  ) => void;
  onStartBossBattleWithModifiers: (
    modifiers: EncounterCombatTraitId[],
    rewardModifiers: EncounterRewardTraitId[],
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
  combat: (node, handlers) => handlers.onStartBattleWithModifiers("normal", node.modifiers, node.rewardModifiers),
  elite: (node, handlers) => handlers.onStartBattleWithModifiers("elite", node.modifiers, node.rewardModifiers),
  boss: (node, handlers) => handlers.onStartBossBattleWithModifiers(node.modifiers, node.rewardModifiers),
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

/** Pending node is owned by the session store — no local ref twin that can diverge after teardown. */
export function useLabyrinthController(): LabyrinthController {
  const resetMap = useCallback(() => {
    dispatchRunSessionCommand((draft) => {
      setActiveLabyrinthPendingNode(draft, null);
      setLabyrinthMap(draft, generateLabyrinthMap(createDraftRunRandomSource(draft, "world")));
    });
  }, []);

  const enterNode = useCallback((row: number, col: number, handlers: LabyrinthNodeHandlers): boolean => {
    const node = dispatchRunSessionCommand((draft) => {
      const session = draft.session;
      if (session.activeLabyrinthPendingNode) return null;

      const map = session.labyrinthMap;
      const node = map.grid[row]?.[col];
      if (!node || !canEnterLabyrinthNode(map, row, col)) return null;

      setActiveLabyrinthPendingNode(draft, { row, col });
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
      if (pendingNode)
        setLabyrinthMap(draft, (previous) => withCurrentNode(previous, pendingNode.row, pendingNode.col));
      return pendingNode;
    });
    if (!pending) {
      console.warn("[useLabyrinthController] onNodeCleared called without a pending node");
    }
  }, []);

  const onNodeFailed = useCallback(() => {
    const pending = dispatchRunSessionCommand((draft) => {
      const pendingNode = draft.session.activeLabyrinthPendingNode;
      setActiveLabyrinthPendingNode(draft, null);
      if (pendingNode) setLabyrinthMap(draft, withFailedNode(current(draft.session.labyrinthMap), pendingNode));
      return pendingNode;
    });
    if (!pending) {
      console.warn("[useLabyrinthController] onNodeFailed called without a pending node");
    }
  }, []);

  return useMemo(
    () => ({ enterNode, onNodeCleared, onNodeFailed, resetMap }),
    [enterNode, onNodeCleared, onNodeFailed, resetMap],
  );
}
