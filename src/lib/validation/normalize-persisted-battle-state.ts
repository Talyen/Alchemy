// Deep-merge persisted battle snapshots with defaultBattleState() so resumed
// combat recovers manifests and flags stripped by JSON save/load.
import { defaultBattleState, type BattleState } from "@/lib/battle";
import { sanitizePersistedEnemyTraits } from "@/lib/content-systems/encounter-traits";

function mergeRecord<T extends object>(defaults: T, saved: Partial<T> | undefined): T {
  return { ...defaults, ...saved };
}

/** Wire input may omit fields that defaults fill; cast is intentional at the persistence boundary. */
export function normalizePersistedBattleState(saved: Partial<BattleState>): BattleState {
  const defaults = defaultBattleState();
  return {
    ...defaults,
    ...saved,
    trinketEffects: mergeRecord(defaults.trinketEffects, saved.trinketEffects),
    gearEffects: mergeRecord(defaults.gearEffects, saved.gearEffects),
    flags: mergeRecord(defaults.flags, saved.flags),
    playerStatuses: mergeRecord(defaults.playerStatuses, saved.playerStatuses),
    enemyStatuses: mergeRecord(defaults.enemyStatuses, saved.enemyStatuses),
    playerCC: mergeRecord(defaults.playerCC, saved.playerCC),
    enemyCC: mergeRecord(defaults.enemyCC, saved.enemyCC),
    enemyMitigation: mergeRecord(defaults.enemyMitigation, saved.enemyMitigation),
    pendingTurnStartEffects: saved.pendingTurnStartEffects ?? defaults.pendingTurnStartEffects,
    currentEnemy: {
      ...defaults.currentEnemy,
      ...saved.currentEnemy,
      traits: sanitizePersistedEnemyTraits(Array.isArray(saved.currentEnemy?.traits) ? saved.currentEnemy.traits : []),
    },
  };
}
