// Labyrinth controller — owns map state, node traversal, and entry routing for
// labyrinth content system runs. Uses useScreenStore for labyrinthMap state.
import { useCallback, useRef } from "react";
import { withCurrentNode } from "@/lib/content-systems/labyrinth/map-generation";
import { LABYRINTH_COLS } from "@/lib/content-systems/labyrinth/data";
import type { LabyrinthMap, LabyrinthModifierKind } from "@/lib/content-systems/types";
import { useScreenStore } from "./stores/screen-store";

export type LabyrinthController = {
  labyrinthMap: LabyrinthMap;
  enterNode: (row: number, col: number, handlers: LabyrinthNodeHandlers) => void;
  onNodeCleared: () => void;
  onNodeFailed: () => void;
  resetMap: () => void;
};

export type LabyrinthNodeHandlers = {
  onStartBattleWithModifiers: (
    enemyType: "normal" | "elite",
    modifiers: LabyrinthModifierKind[],
    rewardModifiers: LabyrinthModifierKind[],
    depth: number,
  ) => void;
  onStartBossBattleWithModifiers: (
    modifiers: LabyrinthModifierKind[],
    rewardModifiers: LabyrinthModifierKind[],
    depth: number,
  ) => void;
  onStartRest: () => void;
  onStartMystery: () => void;
  onStartShop: () => void;
  onStartAlchemist: () => void;
};

export function useLabyrinthController(): LabyrinthController {
  const labyrinthMap = useScreenStore((s) => s.labyrinthMap);
  const pendingNodeRef = useRef<{ row: number; col: number } | null>(null);

  const resetMap = useCallback(() => {
    pendingNodeRef.current = null;
    useScreenStore.getState().resetLabyrinthMap();
  }, []);

  const enterNode = useCallback((row: number, col: number, handlers: LabyrinthNodeHandlers) => {
    const store = useScreenStore.getState();
    const map = store.labyrinthMap;
    const node = map.grid[row]?.[col];
    if (!node || !canEnterLabyrinthNode(map, row, col)) return;

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
  }, []);

  const onNodeCleared = useCallback(() => {
    const pending = pendingNodeRef.current;
    pendingNodeRef.current = null;
    if (!pending) return;
    useScreenStore.getState().setLabyrinthMap((prev) => withCurrentNode(prev, pending.row, pending.col));
  }, []);

  const onNodeFailed = useCallback(() => {
    const pending = pendingNodeRef.current;
    pendingNodeRef.current = null;
    if (!pending) return;
    const store = useScreenStore.getState();
    store.setLabyrinthMap(failPendingLabyrinthNode(store.labyrinthMap, pending));
  }, []);

  return { labyrinthMap, enterNode, onNodeCleared, onNodeFailed, resetMap };
}

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

export function canEnterLabyrinthNode(map: LabyrinthMap, row: number, col: number): boolean {
  const node = map.grid[row]?.[col];
  if (!node) return false;
  const current = map.grid[map.currentNode.row]?.[map.currentNode.col];
  const connectedToCurrent = Boolean(
    current?.connections.some((connection) => connection.row === row && connection.col === col),
  );
  if (node.state === "visible") return connectedToCurrent;
  return false;
}
