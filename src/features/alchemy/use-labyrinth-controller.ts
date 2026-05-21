/**
 * Hook for managing Labyrinth map navigation, state mutations, and node entry.
 * Depends on: map-generation.ts, screen-store.ts, src/lib/content-systems/types.ts
 * Depended on by: use-alchemy-run-controller.ts, tests
 */

import { useCallback, useRef } from "react";
import { canEnterLabyrinthNode, withCurrentNode, withFailedNode } from "@/lib/content-systems/labyrinth/map-generation";
import type { LabyrinthMap, LabyrinthNode, LabyrinthModifierKind } from "@/lib/content-systems/types";
import { useScreenStore } from "./stores/screen-store";
import type { LabyrinthNodePosition } from "./run/types";

export type LabyrinthController = {
  labyrinthMap: LabyrinthMap;
  enterNode: (row: number, col: number, handlers: LabyrinthNodeHandlers) => void;
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
  const pendingNodeRef = useRef<LabyrinthNodePosition | null>(pendingNode);

  const setPendingNode = useCallback((node: LabyrinthNodePosition | null) => {
    pendingNodeRef.current = node;
    useScreenStore.getState().setActiveLabyrinthPendingNode(node);
  }, []);

  const resetMap = useCallback(() => {
    setPendingNode(null);
    useScreenStore.getState().resetLabyrinthMap();
  }, [setPendingNode]);

  const enterNode = useCallback(
    (row: number, col: number, handlers: LabyrinthNodeHandlers) => {
      const store = useScreenStore.getState();
      const map = store.labyrinthMap;
      const node = map.grid[row]?.[col];
      if (!node || !canEnterLabyrinthNode(map, row, col)) return;

      setPendingNode({ row, col });
      routeNodeInteraction(node, handlers);
    },
    [setPendingNode],
  );

  const onNodeCleared = useCallback(() => {
    const pending = pendingNodeRef.current;
    setPendingNode(null);
    if (!pending) return;
    useScreenStore.getState().setLabyrinthMap((prev) => withCurrentNode(prev, pending.row, pending.col));
  }, [setPendingNode]);

  const onNodeFailed = useCallback(() => {
    const pending = pendingNodeRef.current;
    setPendingNode(null);
    if (!pending) return;
    const store = useScreenStore.getState();
    store.setLabyrinthMap(withFailedNode(store.labyrinthMap, pending));
  }, [setPendingNode]);

  return { labyrinthMap, enterNode, onNodeCleared, onNodeFailed, resetMap, pendingNode };
}
