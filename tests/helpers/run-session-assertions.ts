import type { Screen } from "@/lib/routing";
import { getRunSession } from "@/features/alchemy/shared/stores/run-session-model";
import { readActiveRun, readBattle } from "@/features/alchemy/shared/stores/run-session-read-port";

/** Map-layer gold plus in-combat gold (test helper). */
export function getCombinedRunGold(runGold?: number, battleGold?: number): number {
  const run = runGold ?? readActiveRun().runGold;
  const battle = battleGold ?? readBattle().battleState.gold;
  return run + battle;
}

/** Current lifecycle phase from live stores and the active screen (test helper). */
export function getCurrentRunPhase(screen?: Screen) {
  return getRunSession(screen).phase;
}
