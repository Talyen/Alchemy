import { useCallback, useEffect } from "react";
import type { GearInstance } from "@/lib/gear";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";

export function useArmoryInventoryPositions(inventory: GearInstance[]) {
  const savedPositions = useGearStore((state) => state.boardPositions);
  const setBoardPosition = useGearStore((state) => state.setBoardPosition);
  const syncBoardPositions = useGearStore((state) => state.syncBoardPositions);

  useEffect(() => {
    syncBoardPositions();
  }, [inventory, syncBoardPositions]);

  const handleMoveItem = useCallback(
    (instanceId: string, col: number, row: number) => {
      setBoardPosition(instanceId, col, row);
    },
    [setBoardPosition],
  );

  return { savedPositions, handleMoveItem };
}
