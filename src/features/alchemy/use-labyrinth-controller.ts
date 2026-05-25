/**
 * Hook for managing Labyrinth map navigation, state mutations, and node entry.
 * Depends on: map-generation.ts, screen-store.ts, src/lib/content-systems/types.ts
 * Depended on by: use-alchemy-run-controller.ts, tests
 */

import { useCallback, useEffect, useRef } from "react";
import { canEnterLabyrinthNode, withCurrentNode, withFailedNode } from "@/lib/content-systems/labyrinth/map-generation";
import type { LabyrinthMap, LabyrinthNode, LabyrinthModifierKind } from "@/lib/content-systems/types";
import { useScreenStore } from "./stores/screen-store";
import type { LabyrinthNodePosition } from "./run/types";

export type LabyrinthController = {
  labyrinthMap: LabyrinthMap;
  enterNode: (row: number, col: number, handlers: LabyrinthNodeHandlers) => boolean;
  onNodeCleared: () => void;
  onNodeFailed: () => void;
  resetMap: () => void;
  pendingNode: LabyrinthNodePosition | null;
};

export type LabyrinthNodeHandlers = {
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

export function useLabyrinthController(): LabyrinthController {
  const labyrinthMap = useScreenStore((s) => s.labyrinthMap);
  const pendingNode = useScreenStore((s) => s.activeLabyrinthPendingNode);
  const pendingNodeRef = useRef(pendingNode);

  useEffect(() => {
    pendingNodeRef.current = pendingNode;
  }, [pendingNode]);

  const resetMap = useCallback(() => {
    pendingNodeRef.current = null;
    useScreenStore.getState().setActiveLabyrinthPendingNode(null);
    useScreenStore.getState().resetLabyrinthMap();
  }, []);

  const enterNode = useCallback((row: number, col: number, handlers: LabyrinthNodeHandlers): boolean => {
    const store = useScreenStore.getState();
    const map = store.labyrinthMap;
    const node = map.grid[row]?.[col];
    if (!node || !canEnterLabyrinthNode(map, row, col)) return false;

    const pos = { row, col };
    pendingNodeRef.current = pos;
    store.setActiveLabyrinthPendingNode(pos);
    routeNodeInteraction(node, handlers);
    return true;
  }, []);

  const onNodeCleared = useCallback(() => {
    const pending = pendingNodeRef.current;
    pendingNodeRef.current = null;
    useScreenStore.getState().setActiveLabyrinthPendingNode(null);
    if (!pending) {
      console.warn("[useLabyrinthController] onNodeCleared called without a pending node");
      return;
    }
    useScreenStore.getState().setLabyrinthMap((prev) => withCurrentNode(prev, pending.row, pending.col));
  }, []);

  const onNodeFailed = useCallback(() => {
    const pending = pendingNodeRef.current;
    pendingNodeRef.current = null;
    useScreenStore.getState().setActiveLabyrinthPendingNode(null);
    if (!pending) {
      console.warn("[useLabyrinthController] onNodeFailed called without a pending node");
      return;
    }
    useScreenStore.getState().setLabyrinthMap(withFailedNode(useScreenStore.getState().labyrinthMap, pending));
  }, []);

  return { labyrinthMap, enterNode, onNodeCleared, onNodeFailed, resetMap, pendingNode };
}
