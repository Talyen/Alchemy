import type {
  PlayerStatusValues,
  EnemyStatusValues,
  EnemyMitigation,
  TrinketManifest,
  CcState,
  CombatFlags,
} from "@/lib/battle/types";
import { defaultBattleState, defaultTalentEffects, EMPTY_ENEMY_MITIGATION } from "@/lib/battle";
import { defaultTrinketEffects } from "@/lib/trinkets";

export { defaultTalentEffects };

export function defaultPlayerStatusValues(overrides?: Partial<PlayerStatusValues>): PlayerStatusValues {
  return { ...defaultBattleState().playerStatuses, ...overrides };
}

export function defaultEnemyStatusValues(overrides?: Partial<EnemyStatusValues>): EnemyStatusValues {
  return { ...defaultBattleState().enemyStatuses, ...overrides };
}

export function defaultEnemyMitigation(overrides?: Partial<EnemyMitigation>): EnemyMitigation {
  return { ...EMPTY_ENEMY_MITIGATION, ...overrides };
}

export function defaultCcState(overrides?: Partial<CcState>): CcState {
  return { ...defaultBattleState().playerCC, ...overrides };
}

export function defaultCombatFlags(overrides?: Partial<CombatFlags>): CombatFlags {
  return { ...defaultBattleState().flags, ...overrides };
}

export function defaultTrinketManifest(overrides?: Partial<TrinketManifest>): TrinketManifest {
  return { ...defaultTrinketEffects, ...overrides };
}
