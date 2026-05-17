// Labyrinth controller — owns map state, node traversal, and entry routing for
// labyrinth content system runs. Used by the alchemy controller to manage screen
// transitions distinct from the campaign's act/destination flow.
import { useCallback, useRef, useState } from "react";
import { generateLabyrinthMap, withCurrentNode } from "@/lib/content-systems/labyrinth/map-generation";
import { LABYRINTH_COLS } from "@/lib/content-systems/labyrinth/data";
import type { LabyrinthMap, LabyrinthModifierKind } from "@/lib/content-systems/types";

export type LabyrinthController = {
  labyrinthMap: LabyrinthMap;
  enterNode: (row: number, col: number, handlers: LabyrinthNodeHandlers) => void;
  onNodeCleared: () => void;
  onNodeFailed: () => void;
  resetMap: () => void;
};

export type LabyrinthNodeHandlers = {
  onStartBattleWithModifiers: (enemyType: "normal" | "elite", modifiers: LabyrinthModifierKind[], rewardModifiers: LabyrinthModifierKind[], depth: number) => void;
  onStartBossBattleWithModifiers: (modifiers: LabyrinthModifierKind[], rewardModifiers: LabyrinthModifierKind[], depth: number) => void;
  onStartRest: () => void;
  onStartMystery: () => void;
  onStartShop: () => void;
  onStartAlchemist: () => void;
};

export function useLabyrinthController(initialMap: LabyrinthMap | null = null): LabyrinthController {
  const [labyrinthMap, setLabyrinthMap] = useState<LabyrinthMap>(() => initialMap ?? generateLabyrinthMap());
  const pendingNodeRef = useRef<{ row: number; col: number } | null>(null);

  const resetMap = useCallback(() => {
    pendingNodeRef.current = null;
    setLabyrinthMap(generateLabyrinthMap());
  }, []);

  const enterNode = useCallback((row: number, col: number, handlers: LabyrinthNodeHandlers) => {
    const node = labyrinthMap.grid[row]?.[col];
    if (!node || !canEnterLabyrinthNode(labyrinthMap, row, col)) return;

    pendingNodeRef.current = { row, col };

    switch (node.type) {
      case "combat":
      case "elite": {
        const enemyType = node.type === "elite" ? "elite" : "normal";
        handlers.onStartBattleWithModifiers(enemyType, node.modifiers, node.rewardModifiers, row);
        break;
      }
      case "boss": {
        handlers.onStartBossBattleWithModifiers(node.modifiers, node.rewardModifiers, row);
        break;
      }
      case "entrance": {
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
    const pending = pendingNodeRef.current;
    pendingNodeRef.current = null;
    if (!pending) return;

    setLabyrinthMap((prev) => {
      const next = withCurrentNode(prev, pending.row, pending.col);
      const cleared = next.grid[pending.row]?.[pending.col];
      if (cleared && cleared.state === "current") {
        cleared.state = "cleared";
      }
      return next;
    });
  }, []);

  const onNodeFailed = useCallback(() => {
    const pending = pendingNodeRef.current;
    pendingNodeRef.current = null;
    if (!pending) return;

    setLabyrinthMap((prev) => failPendingLabyrinthNode(prev, pending));
  }, []);

  return { labyrinthMap, enterNode, onNodeCleared, onNodeFailed, resetMap };
}

// Failure returns the player to the entrance and clears any previous current marker
// so the map never renders multiple active positions after a lost encounter.
export function failPendingLabyrinthNode(map: LabyrinthMap, pending: { row: number; col: number }): LabyrinthMap {
  const next: LabyrinthMap = {
    ...map,
    grid: map.grid.map((r) => r.map((n) => (n ? { ...n, connections: [...n.connections] } : n))),
  };
  for (const row of next.grid) {
    for (const node of row) {
      if (node?.state === "current") node.state = "cleared";
    }
  }
  const failed = next.grid[pending.row]?.[pending.col];
  if (failed) failed.state = "failed";
  const startCol = Math.floor(LABYRINTH_COLS / 2);
  const start = next.grid[0]?.[startCol];
  if (start && start.state !== "failed") {
    start.state = "current";
    next.currentNode = { row: 0, col: startCol };
  }
  return next;
}

// Labyrinth traversal is graph-based: only visible nodes connected to the current
// position can be entered, while the current entrance/chamber itself cannot replay.
export function canEnterLabyrinthNode(map: LabyrinthMap, row: number, col: number): boolean {
  const node = map.grid[row]?.[col];
  if (!node) return false;
  const current = map.grid[map.currentNode.row]?.[map.currentNode.col];
  const connectedToCurrent = Boolean(current?.connections.some((connection) => connection.row === row && connection.col === col));
  if (node.state === "visible") return connectedToCurrent;
  return false;
}
