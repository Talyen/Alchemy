import { useCallback, useEffect } from "react";
import type { CharacterId } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";

export function useArmoryInventoryPositions(characterId: CharacterId, inventory: GearInstance[]) {
  const savedPositions = useGearStore((state) => state.boardPositionsByCharacter[characterId] ?? {});
  const setBoardPosition = useGearStore((state) => state.setBoardPosition);
  const syncBoardPositions = useGearStore((state) => state.syncBoardPositions);

  useEffect(() => {
    syncBoardPositions();
  }, [inventory, syncBoardPositions]);

  const handleMoveItem = useCallback(
    (instanceId: string, col: number, row: number) => {
      setBoardPosition(characterId, instanceId, col, row);
    },
    [characterId, setBoardPosition],
  );

  return { savedPositions, handleMoveItem };
}
