// Whether battle teardown should wait until leaving the battle screen after a win.
import type { Screen } from "../../shared/types";

export function isVictoryGraceActive(screen: Screen, enemyHealth: number, victoryDefeatHandled: boolean): boolean {
  return screen === "battle" && enemyHealth <= 0 && victoryDefeatHandled;
}
