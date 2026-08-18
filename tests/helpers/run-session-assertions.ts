import type { Screen } from "@/lib/routing";
import { getRunSession } from "@/features/alchemy/shared/stores/run-session-model";
import { readRunProfile, readBattle } from "@/features/alchemy/shared/stores/run-session-read-port";

/** Shared gold purse (test helper). */
export function getCombinedRunGold(runGold?: number, battleGold?: number): number {
  if (runGold != null) return runGold;
  if (battleGold != null) return battleGold;
  return readRunProfile().gold || readBattle().battleState.gold;
}

/** Current lifecycle phase from live stores and the active screen (test helper). */
export function getCurrentRunPhase(screen?: Screen) {
  return getRunSession(screen).phase;
}
