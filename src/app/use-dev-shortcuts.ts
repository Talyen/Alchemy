// Dev-build shortcuts wired at the app shell — kept out of shared/utils to avoid battle import cycles.
import { useCallback } from "react";
import { cardLibrary, enemyBestiary, trinketLibrary } from "@/lib/game-data";
import {
  setDiscoveredCardIds,
  setDiscoveredTrinketIds,
  setEncounteredEnemyIds,
  setFinishedRunCharacters,
} from "@/features/alchemy/shared/stores/profile-store";
import { setMaterials } from "@/features/alchemy/shared/stores/run-session-write-port";
import { clearAllPersistentGameData } from "@/features/alchemy/shared/stores/reset";
import type { AlchemyRunCommands } from "@/features/alchemy/shell/use-alchemy-run-controller";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";

export function useDevShortcuts(run: Pick<AlchemyRunCommands, "resetRunState" | "unlockAllTalents">) {
  const clearSaveData = useCallback(() => {
    clearAllPersistentGameData();
    run.resetRunState();
  }, [run]);

  const unlockAllDevMode = useCallback(() => {
    if (!isAlchemyDevBuild()) return;
    setDiscoveredCardIds(cardLibrary.map((card) => card.id));
    setEncounteredEnemyIds(enemyBestiary.map((enemy) => enemy.id));
    setDiscoveredTrinketIds(trinketLibrary.map((boon) => boon.id));
    setFinishedRunCharacters(["knight", "rogue", "wizard", "ranger", "alchemist", "warlock", "druid"]);
    run.unlockAllTalents();
    setMaterials({ wood: 99, iron: 99, herbs: 99, food: 99, crystal: 99 });
  }, [run]);

  return { clearSaveData, unlockAllDevMode };
}
