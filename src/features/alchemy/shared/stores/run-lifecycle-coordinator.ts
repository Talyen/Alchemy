// Single entry for run lifecycle: battle sync, teardown, and immediate persistence flushes.
import { getBattleStartPlayerHealth } from "@/lib/battle";
import { playDefeat, stopAllSfx } from "@/lib/audio";
import type { ActiveRunData } from "@/lib/active-run-session";
import { flushAlchemySaveNow } from "@/features/alchemy/storage";
import { useRunStore } from "./run-progress-store";
import { useBattleStore } from "./battle-store";
import { resetActiveRunStores } from "./reset";

/** Clamp run HP for battle entry and persist before creating BattleState. */
export function syncRunToBattleStart(playerHealth?: number): number {
  const run = useRunStore.getState();
  const startingHealth =
    playerHealth ?? getBattleStartPlayerHealth(run.runPlayerHealth, run.runMaxHealth, run.runTrinkets);
  run.setRunPlayerHealth(startingHealth);
  return startingHealth;
}

/** Persist combat HP to the run store after victory or when leaving battle. */
export function syncBattleToRun(options?: { playerHealth?: number }): void {
  const battle = useBattleStore.getState().battleState;
  const health = options?.playerHealth ?? battle.playerHealth;
  useRunStore.getState().setRunPlayerHealth(health);
}

/** Clear active combat, run progression, session UI, and navigation screen. */
export function teardownRun(): void {
  resetActiveRunStores();
}

/** Write the full save file immediately (bypasses autosave debounce). */
export async function flushPersistedSave(activeRun: ActiveRunData | null): Promise<void> {
  await flushAlchemySaveNow(activeRun);
}

/** Persist meta/talent progress after a run ends with no resumable active run. */
export function flushSaveAfterRunEnd(): void {
  void flushPersistedSave(null);
}

/** Defeat flow: finalize rewards/XP, persist, audio, and clear combat state. */
export function applyRunDefeatTeardown(options: {
  awardRunEndMaterials: () => void;
  finalizeRunXP: () => void;
  clearCombatState: () => void;
}): void {
  options.awardRunEndMaterials();
  options.finalizeRunXP();
  flushSaveAfterRunEnd();
  stopAllSfx();
  playDefeat();
  options.clearCombatState();
}
