/**
 * Hook for managing Labyrinth map navigation, state mutations, and node entry.
 * Depends on: map-generation.ts, screen-store.ts, src/lib/content-systems/types.ts
 * Depended on by: use-alchemy-run-controller.ts, tests
 */

import { useCallback, useEffect, useRef } from "react";
import {
  canEnterLabyrinthNode,
  withCurrentNode,
  withFailedNode,
  generateLabyrinthMap,
} from "@/lib/content-systems/labyrinth/map-generation";
import type { LabyrinthMap, LabyrinthNode, LabyrinthModifierKind } from "@/lib/content-systems/types";
import { useRunSessionLabyrinthSlice } from "@/features/alchemy/stores/run-session-facade";
import { setActiveLabyrinthPendingNode, setLabyrinthMap } from "@/features/alchemy/stores/run-session-actions";
import { readRunSessionStore } from "@/features/alchemy/stores/run-session-read";
import type { Screen } from "@/features/alchemy/types";
import type { LabyrinthNodePosition } from "@/lib/active-run-session";

export type LabyrinthController = {
  labyrinthMap: LabyrinthMap;
  enterNode: (row: number, col: number, handlers: LabyrinthNodeHandlers) => boolean;
  onNodeCleared: () => void;
  onNodeFailed: () => void;
  resetMap: () => void;
  pendingNode: LabyrinthNodePosition | null;
};

type LabyrinthNodeHandlers = {
  onStartBattleWithModifiers: (
    enemyType: "normal" | "elite",
    modifiers: LabyrinthModifierKind[],
    rewardModifiers: LabyrinthModifierKind[],
  ) => void;
  onStartBossBattleWithModifiers: (
    modifiers: LabyrinthModifierKind[],
    rewardModifiers: LabyrinthModifierKind[],
  ) => void;
  onStartRest: () => void;
  onStartMystery: () => void;
  onStartShop: () => void;
  onStartAlchemist: () => void;
};

/**
 * Handles navigation routing logic based on the type of entered node.
 */
function routeNodeInteraction(node: LabyrinthNode, handlers: LabyrinthNodeHandlers): void {
  switch (node.type) {
    case "combat":
    case "elite": {
      const enemyType = node.type === "elite" ? "elite" : "normal";
      handlers.onStartBattleWithModifiers(enemyType, node.modifiers, node.rewardModifiers);
      break;
    }
    case "boss": {
      handlers.onStartBossBattleWithModifiers(node.modifiers, node.rewardModifiers);
      break;
    }
    case "entrance":
      break;
    case "rest":
      handlers.onStartRest();
      break;
    case "mystery":
      handlers.onStartMystery();
      break;
    case "shop":
      handlers.onStartShop();
      break;
    case "alchemist":
      handlers.onStartAlchemist();
      break;
  }
}

export function useLabyrinthController(_screen: Screen): LabyrinthController {
  const { labyrinthMap, activeLabyrinthPendingNode: pendingNode } = useRunSessionLabyrinthSlice();
  const pendingNodeRef = useRef(pendingNode);

  useEffect(() => {
    pendingNodeRef.current = pendingNode;
  }, [pendingNode]);

  const resetMap = useCallback(() => {
    pendingNodeRef.current = null;
    setActiveLabyrinthPendingNode(null);
    setLabyrinthMap(generateLabyrinthMap());
  }, []);

  const enterNode = useCallback((row: number, col: number, handlers: LabyrinthNodeHandlers): boolean => {
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
