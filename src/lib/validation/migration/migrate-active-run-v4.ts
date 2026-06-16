import { migrateBattleStateV4 } from "./migrate-battle-state-v4";
import { migrateWildwoodDraftV4 } from "./migrate-wildwood-draft-v4";
import type { RawSaveData } from "./types";

function migrateActiveCombatV4(activeCombat: unknown): unknown {
  if (!activeCombat || typeof activeCombat !== "object") return activeCombat;
  const combat = activeCombat as RawSaveData;
  if (!combat.battleState) return activeCombat;
  return {
    ...combat,
    battleState: migrateBattleStateV4(combat.battleState),
  };
}

function stripLegacyRunKeysV4(activeRun: RawSaveData): RawSaveData {
  const next = { ...activeRun };
  delete next.runTrinkets;
  delete next.discoveredTrinketIdsAtRunStart;
  return next;
}

/** v3→v4 run-level renames (frozen). Converts trinket fields to boon fields. */
export function migrateActiveRunV4(activeRun: unknown): unknown {
  if (!activeRun || typeof activeRun !== "object") return activeRun;
  const run = activeRun as RawSaveData;

  const migrated: RawSaveData = stripLegacyRunKeysV4({
    ...run,
    runBoons: Array.isArray(run.runBoons) ? run.runBoons : Array.isArray(run.runTrinkets) ? run.runTrinkets : [],
    discoveredBoonIdsAtRunStart: Array.isArray(run.discoveredBoonIdsAtRunStart)
      ? run.discoveredBoonIdsAtRunStart
      : Array.isArray(run.discoveredTrinketIdsAtRunStart)
        ? run.discoveredTrinketIdsAtRunStart
        : [],
    wildwoodDraft: migrateWildwoodDraftV4(run.wildwoodDraft),
    activeCombat: migrateActiveCombatV4(run.activeCombat),
  });

  return migrated;
}
