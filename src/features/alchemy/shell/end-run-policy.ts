import { CONSTANTS } from "@/features/alchemy/shared/types";

/** Campaign battles surrender via forced defeat; labyrinth always abandons the full run. */
export function shouldSurrenderBattleOnEndRun(
  screen: string,
  hasActiveBattle: boolean,
  contentSystemType: string | null | undefined,
): boolean {
  return (
    screen === CONSTANTS.SCREENS.BATTLE && hasActiveBattle && contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.LABYRINTH
  );
}
