// Deep-merge persisted battle snapshots with defaultBattleState() so resumed
// combat recovers manifests and flags stripped by JSON save/load.
import { defaultBattleState, type BattleState } from "@/lib/battle";
import { sanitizePersistedEnemyTraits } from "@/lib/content-systems/encounter-traits";

/** Wire input may omit fields that defaults fill; cast is intentional at the persistence boundary. */
export function normalizePersistedBattleState(saved: Partial<BattleState>): BattleState {
  const defaults = defaultBattleState();
  return {
    ...defaults,
    ...saved,
    trinketEffects: { ...defaults.trinketEffects, ...saved.trinketEffects },
    gearEffects: { ...defaults.gearEffects, ...saved.gearEffects },
    flags: { ...defaults.flags, ...saved.flags },
    pendingTurnStartEffects: saved.pendingTurnStartEffects ?? defaults.pendingTurnStartEffects,
    currentEnemy: {
      ...defaults.currentEnemy,
      ...saved.currentEnemy,
      traits: sanitizePersistedEnemyTraits(Array.isArray(saved.currentEnemy?.traits) ? saved.currentEnemy.traits : []),
    },
  };
}
