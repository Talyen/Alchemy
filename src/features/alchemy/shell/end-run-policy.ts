import { ROUTE_SCREENS } from "@/lib/routing";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";

export function shouldSurrenderBattleOnEndRun(
  screen: string,
  hasActiveBattle: boolean,
  contentSystemType: string | null | undefined,
): boolean {
  return screen === ROUTE_SCREENS.BATTLE && hasActiveBattle && contentSystemType !== CONTENT_SYSTEMS.LABYRINTH;
}
