import { useCallback, useEffect } from "react";
import { CRAFTING_CURRENCY_IDS, type CraftingCurrencyId } from "@/lib/gear";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";

export function useArmoryCurrencyPositions(craftingCurrencies: Record<CraftingCurrencyId, number>) {
  const savedPositions = useGearStore((state) => state.currencyBoardPositions);
  const setCurrencyBoardPosition = useGearStore((state) => state.setCurrencyBoardPosition);
  const syncBoardPositions = useGearStore((state) => state.syncBoardPositions);

  useEffect(() => {
    syncBoardPositions();
  }, [craftingCurrencies, syncBoardPositions]);

  const handleMoveCurrency = useCallback(
    (currencyId: CraftingCurrencyId, col: number, row: number) => {
      setCurrencyBoardPosition(currencyId, col, row);
    },
    [setCurrencyBoardPosition],
  );

  const activeCurrencyIds = CRAFTING_CURRENCY_IDS.filter((id) => (craftingCurrencies[id] ?? 0) > 0);

  return { savedPositions, activeCurrencyIds, handleMoveCurrency };
}
