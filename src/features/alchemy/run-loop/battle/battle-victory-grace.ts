import type { Screen } from "@/lib/routing";

export function isVictoryGraceActive(screen: Screen, enemyHealth: number, victoryDefeatHandled: boolean): boolean {
  return screen === "battle" && enemyHealth <= 0 && victoryDefeatHandled;
}
