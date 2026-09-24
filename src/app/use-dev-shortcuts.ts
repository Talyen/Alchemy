import { discoverCardIds, discoverTrinketIds, discoverUniqueIds } from "@/features/alchemy/shared/stores/profile-store";
import { clearAllPersistentGameData } from "@/features/alchemy/shared/stores/reset";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  setEncounteredEnemyIds,
  setFinishedRunCharacters,
  setMaterials,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import type { AlchemyRunCommands } from "@/features/alchemy/shell/route-commands";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";
import { cardLibrary, enemyBestiary, trinketLibrary } from "@/lib/game-data";
import { uniqueItemList } from "@/lib/gear";
import { useCallback } from "react";

export function useDevShortcuts(run: Pick<AlchemyRunCommands, "resetRunState" | "unlockAllTalents">) {
  const { resetRunState, unlockAllTalents } = run;
  const clearSaveData = useCallback(() => {
    void clearAllPersistentGameData().then((cleared) => {
      if (cleared) resetRunState();
    });
  }, [resetRunState]);

  const unlockAllDevMode = useCallback(() => {
    if (!isAlchemyDevBuild()) return;
    dispatchRunSessionCommand((draft) => {
      discoverCardIds(
        draft,
        cardLibrary.map((card) => card.id),
      );
      setEncounteredEnemyIds(
        draft,
        enemyBestiary.map((enemy) => enemy.id),
      );
      discoverTrinketIds(
        draft,
        trinketLibrary.map((boon) => boon.id),
      );
      discoverUniqueIds(
        draft,
        uniqueItemList.map((unique) => unique.id),
      );
      setFinishedRunCharacters(draft, ["knight", "rogue", "wizard", "ranger", "alchemist", "warlock", "druid"]);
      setMaterials(draft, { wood: 99, stone: 99, iron: 99, food: 99, herbs: 99, hide: 99, gems: 99 });
    });
    unlockAllTalents();
  }, [unlockAllTalents]);

  return { clearSaveData, unlockAllDevMode };
}
