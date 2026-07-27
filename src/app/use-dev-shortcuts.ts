// Dev-build shortcuts wired at the app shell — kept out of shared/utils to avoid battle import cycles.
import { useCallback } from "react";
import { cardLibrary, enemyBestiary, trinketLibrary } from "@/lib/game-data";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { setMaterials } from "@/features/alchemy/shared/stores/run-session-facade";
import { clearAllPersistentGameData } from "@/features/alchemy/shared/stores/reset";
import type { useAlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";

export function useDevShortcuts(run: ReturnType<typeof useAlchemyRunController>) {
  const clearSaveData = useCallback(() => {
    clearAllPersistentGameData();
    run.resetRunState();
  }, [run]);

  const unlockAllDevMode = useCallback(() => {
    if (!isAlchemyDevBuild()) return;
    useAppStore.getState().setDiscoveredCardIds(cardLibrary.map((card) => card.id));
    useAppStore.getState().setEncounteredEnemyIds(enemyBestiary.map((enemy) => enemy.id));
    useAppStore.getState().setDiscoveredTrinketIds(trinketLibrary.map((boon) => boon.id));
    useAppStore
      .getState()
      .setFinishedRunCharacters(["knight", "rogue", "wizard", "ranger", "alchemist", "warlock", "druid"]);
    run.unlockAllTalents();
    setMaterials({ wood: 99, iron: 99, herbs: 99, food: 99, crystal: 99 });
  }, [run]);

  return { clearSaveData, unlockAllDevMode };
}
