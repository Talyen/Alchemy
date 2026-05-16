// Labyrinth controller — owns map state, node traversal, and entry routing for
// labyrinth content system runs. Used by the alchemy controller to manage screen
// transitions distinct from the campaign's act/destination flow.
import { useCallback, useState } from "react";
import { generateLabyrinthMap, failNode, withCurrentNode } from "@/lib/content-systems/labyrinth/map-generation";
import type { LabyrinthMap } from "@/lib/content-systems/types";

export type LabyrinthController = {
  labyrinthMap: LabyrinthMap;
  enterNode: (row: number, col: number, handlers: LabyrinthNodeHandlers) => void;
  onNodeCleared: () => void;
  onNodeFailed: () => void;
  resetMap: () => void;
};

export type LabyrinthNodeHandlers = {
  onStartBattleWithModifiers: (enemyType: "normal" | "elite", modifiers: string[]) => void;
  onStartBossBattleWithModifiers: (modifiers: string[]) => void;
  onGrantTreasure: () => void;
  onStartRest: () => void;
  onStartMystery: () => void;
  onStartShop: () => void;
  onStartAlchemist: () => void;
};

export function useLabyrinthController(initialMap: LabyrinthMap | null = null): LabyrinthController {
  const [labyrinthMap, setLabyrinthMap] = useState<LabyrinthMap>(() => initialMap ?? generateLabyrinthMap());

  const resetMap = useCallback(() => {
    setLabyrinthMap(generateLabyrinthMap());
  }, []);

  const enterNode = useCallback((row: number, col: number, handlers: LabyrinthNodeHandlers) => {
    const node = labyrinthMap.grid[row]?.[col];
    if (!node || !canEnterLabyrinthNode(labyrinthMap, row, col)) return;

    setLabyrinthMap((prev) => withCurrentNode(prev, row, col));

    switch (node.type) {
      case "combat":
      case "elite": {
        const enemyType = node.type === "elite" ? "elite" : "normal";
        handlers.onStartBattleWithModifiers(enemyType, node.modifiers);
        break;
      }
      case "boss": {
        handlers.onStartBossBattleWithModifiers(node.modifiers);
        break;
      }
      case "treasure": {
        handlers.onGrantTreasure();
        break;
      }
      case "rest": {
        handlers.onStartRest();
        break;
      }
      case "mystery": {
        handlers.onStartMystery();
        break;
      }
      case "shop": {
        handlers.onStartShop();
        break;
      }
      case "alchemist": {
        handlers.onStartAlchemist();
        break;
      }
    }
  }, [labyrinthMap]);

  const onNodeCleared = useCallback(() => {
    setLabyrinthMap((prev) => {
      const next = { ...prev, grid: prev.grid.map((r) => r.map((n) => (n ? { ...n } : n))) };
      const node = next.grid[next.currentNode.row]?.[next.currentNode.col];
      if (node && node.state === "current") {
        node.state = "cleared";
      }
      return next;
    });
  }, []);

  const onNodeFailed = useCallback(() => {
    setLabyrinthMap((prev) => {
      const next = { ...prev, grid: prev.grid.map((r) => r.map((n) => (n ? { ...n } : n))) };
      failNode(next, next.currentNode.row, next.currentNode.col);
      return next;
    });
  }, []);

  return { labyrinthMap, enterNode, onNodeCleared, onNodeFailed, resetMap };
}

// The first Labyrinth node starts as current but still represents the opening
// combat; later current nodes have already been entered and should not re-fire.
export function canEnterLabyrinthNode(map: LabyrinthMap, row: number, col: number): boolean {
  const node = map.grid[row]?.[col];
  if (!node) return false;
  if (node.state === "visible") return true;
  return row === 0 && col === 2 && node.state === "current" && node.type === "combat";
}
