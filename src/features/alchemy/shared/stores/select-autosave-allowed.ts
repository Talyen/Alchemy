import { getRunPhase, type Screen } from "@/lib/routing";

export function selectAutosaveAllowed(
  state: {
    battle: { hasActiveBattle: boolean; battleState: { enemyHealth: number } };
    session: { rewardClaimInFlight: boolean; rewardState: { choices: unknown[] } };
  },
  screen: Screen,
): boolean {
  const phase = getRunPhase(screen, state.battle.hasActiveBattle);
  if (phase === "runEnd") return false;
  if (phase === "battle" && state.battle.battleState.enemyHealth <= 0) return false;

  return true;
}
