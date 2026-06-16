import { migrateBattleState } from "./migrate-battle-state";
import { migrateWildwoodDraft } from "./migrate-wildwood-draft";
import type { RawSaveData } from "./types";

function migrateActiveCombat(activeCombat: unknown): unknown {
  if (!activeCombat || typeof activeCombat !== "object") return activeCombat;
  const combat = activeCombat as RawSaveData;
  if (!combat.battleState) return activeCombat;
  return {
    ...combat,
    battleState: migrateBattleState(combat.battleState),
  };
}

function stripLegacyRunKeys(activeRun: RawSaveData): RawSaveData {
  const next = { ...activeRun };
  delete next.runBoons;
  delete next.discoveredBoonIdsAtRunStart;
  delete next.discoveredCardIdsAtRunStart;
  delete next.discoveredTrinketIdsAtRunStart;
  return next;
}

/** Orchestrates run-level renames and nested activeRun migrations. */
export function migrateActiveRun(activeRun: unknown): unknown {
  if (!activeRun || typeof activeRun !== "object") return activeRun;
  const run = activeRun as RawSaveData;

  const migrated: RawSaveData = stripLegacyRunKeys({
    ...run,
    runTrinkets: Array.isArray(run.runTrinkets) ? run.runTrinkets : Array.isArray(run.runBoons) ? run.runBoons : [],
    wildwoodDraft: migrateWildwoodDraft(run.wildwoodDraft),
    activeCombat: migrateActiveCombat(run.activeCombat),
  });

  return migrated;
}
