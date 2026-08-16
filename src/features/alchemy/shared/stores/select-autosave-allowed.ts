import { getRunPhase, type Screen } from "@/lib/routing";

/** Autosave gate used by the app shell. Returns a stable boolean so HP ticks do not re-render App. */
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
  if (screen === "rewards" && !state.session.rewardClaimInFlight && state.session.rewardState.choices.length === 0) {
    return false;
  }
  return true;
}
