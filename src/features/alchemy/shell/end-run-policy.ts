import { ROUTE_SCREENS } from "@/lib/routing";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";

/** Campaign battles surrender via forced defeat; labyrinth always abandons the full run. */
export function shouldSurrenderBattleOnEndRun(
  screen: string,
  hasActiveBattle: boolean,
  contentSystemType: string | null | undefined,
): boolean {
  return screen === ROUTE_SCREENS.BATTLE && hasActiveBattle && contentSystemType !== CONTENT_SYSTEMS.LABYRINTH;
}
