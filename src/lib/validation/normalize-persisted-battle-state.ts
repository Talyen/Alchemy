// Deep-merge persisted battle snapshots with defaultBattleState() so resumed
// combat recovers manifests and flags stripped by JSON save/load.
import { defaultBattleState, type BattleState } from "@/lib/battle";
import { sanitizePersistedEnemyTraits } from "@/lib/content-systems/encounter-traits";

export function normalizePersistedBattleState(saved: BattleState): BattleState {
  const defaults = defaultBattleState();
  return {
    ...defaults,
    ...saved,
    trinketEffects: { ...defaults.trinketEffects, ...saved.trinketEffects },
    gearEffects: { ...defaults.gearEffects, ...saved.gearEffects },
    flags: { ...defaults.flags, ...saved.flags },
    currentEnemy: {
      ...saved.currentEnemy,
      traits: sanitizePersistedEnemyTraits(Array.isArray(saved.currentEnemy.traits) ? saved.currentEnemy.traits : []),
    },
  };
}
