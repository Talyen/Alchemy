/**
 * Hook for managing Labyrinth map navigation, state mutations, and node entry.
 * Depends on: map-generation.ts, run-session-read-port, src/lib/content-systems/types.ts
 * Depended on by: use-alchemy-run-controller.ts, tests
 */

import { useCallback } from "react";
import { current } from "immer";
import {
  canEnterLabyrinthNode,
  withCurrentNode,
  withFailedNode,
  generateLabyrinthMap,
} from "@/lib/content-systems/labyrinth/map-generation";
import type { EncounterCombatTraitId, EncounterRewardTraitId, LabyrinthNode } from "@/lib/content-systems/types";
import { readRunSession } from "@/features/alchemy/shared/stores/run-session-read-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  setActiveLabyrinthPendingNode,
  setLabyrinthMap,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import type { Screen } from "@/features/alchemy/shared/types";

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

/** Pending node is owned by the session store — no local ref twin that can diverge after teardown. */
export function useLabyrinthController(_screen: Screen, rng: () => number): LabyrinthController {
  const resetMap = useCallback(() => {
    setActiveLabyrinthPendingNode(null);
    setLabyrinthMap(generateLabyrinthMap(rng));
  }, [rng]);

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
    const pending = readRunSession().activeLabyrinthPendingNode;
    setActiveLabyrinthPendingNode(null);
    if (!pending) {
      console.warn("[useLabyrinthController] onNodeCleared called without a pending node");
      return;
    }
    setLabyrinthMap((prev) => withCurrentNode(prev, pending.row, pending.col));
  }, []);

  const onNodeFailed = useCallback(() => {
    const pending = readRunSession().activeLabyrinthPendingNode;
    setActiveLabyrinthPendingNode(null);
    if (!pending) {
      console.warn("[useLabyrinthController] onNodeFailed called without a pending node");
      return;
    }
    setLabyrinthMap(withFailedNode(readRunSession().labyrinthMap, pending));
  }, []);

  return { enterNode, onNodeCleared, onNodeFailed, resetMap };
}
