/**
 * Hook for managing Labyrinth map navigation, state mutations, and node entry.
 * Depends on: map-generation.ts, run-session-facade, src/lib/content-systems/types.ts
 * Depended on by: use-alchemy-run-controller.ts, tests
 */

import { useCallback, useEffect, useRef } from "react";
import {
  canEnterLabyrinthNode,
  withCurrentNode,
  withFailedNode,
  generateLabyrinthMap,
} from "@/lib/content-systems/labyrinth/map-generation";
import type {
  EncounterCombatTraitId,
  EncounterRewardTraitId,
  LabyrinthMap,
  LabyrinthNode,
} from "@/lib/content-systems/types";
import { useRunSessionLabyrinthSlice } from "@/features/alchemy/shared/stores/run-session-facade";
import { setActiveLabyrinthPendingNode, setLabyrinthMap } from "@/features/alchemy/shared/stores/run-session-facade";
import { readRunSessionStore } from "@/features/alchemy/shared/stores/run-session-facade";
import type { Screen } from "@/features/alchemy/shared/types";
import type { LabyrinthNodePosition } from "@/lib/active-run-session";

export interface LabyrinthController {
  labyrinthMap: LabyrinthMap;
  enterNode: (row: number, col: number, handlers: LabyrinthNodeHandlers) => boolean;
  onNodeCleared: () => void;
  onNodeFailed: () => void;
  resetMap: () => void;
  pendingNode: LabyrinthNodePosition | null;
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

const NODE_ACTIONS: Partial<Record<LabyrinthNode["type"], NodeAction>> = {
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

/**
 * Handles navigation routing logic based on the type of entered node.
 */
function routeNodeInteraction(node: LabyrinthNode, handlers: LabyrinthNodeHandlers): void {
  NODE_ACTIONS[node.type]?.(node, handlers);
}

export function useLabyrinthController(_screen: Screen, rng: () => number): LabyrinthController {
  const { labyrinthMap, activeLabyrinthPendingNode: pendingNode } = useRunSessionLabyrinthSlice();
  const pendingNodeRef = useRef(pendingNode);

  useEffect(() => {
    pendingNodeRef.current = pendingNode;
  }, [pendingNode]);

  const resetMap = useCallback(() => {
    pendingNodeRef.current = null;
    setActiveLabyrinthPendingNode(null);
    setLabyrinthMap(generateLabyrinthMap(rng));
  }, [rng]);

  const enterNode = useCallback((row: number, col: number, handlers: LabyrinthNodeHandlers): boolean => {
    if (pendingNodeRef.current) return false;

    const map = readRunSessionStore().labyrinthMap;
    const node = map.grid[row]?.[col];
    if (!node || !canEnterLabyrinthNode(map, row, col)) return false;

    const pos = { row, col };
    pendingNodeRef.current = pos;
    setActiveLabyrinthPendingNode(pos);
    routeNodeInteraction(node, handlers);
    return true;
  }, []);

  const onNodeCleared = useCallback(() => {
    const pending = pendingNodeRef.current;
    pendingNodeRef.current = null;
    setActiveLabyrinthPendingNode(null);
    if (!pending) {
      console.warn("[useLabyrinthController] onNodeCleared called without a pending node");
      return;
    }
    setLabyrinthMap((prev) => withCurrentNode(prev, pending.row, pending.col));
  }, []);

  const onNodeFailed = useCallback(() => {
    const pending = pendingNodeRef.current;
    pendingNodeRef.current = null;
    setActiveLabyrinthPendingNode(null);
    if (!pending) {
      console.warn("[useLabyrinthController] onNodeFailed called without a pending node");
      return;
    }
    setLabyrinthMap(withFailedNode(readRunSessionStore().labyrinthMap, pending));
  }, []);

  return { labyrinthMap, enterNode, onNodeCleared, onNodeFailed, resetMap, pendingNode };
}
