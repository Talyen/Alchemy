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

const template = defaultBattleState();

export function defaultPlayerStatusValues(overrides?: Partial<PlayerStatusValues>): PlayerStatusValues {
  return { ...template.playerStatuses, ...overrides };
}

export function defaultEnemyStatusValues(overrides?: Partial<EnemyStatusValues>): EnemyStatusValues {
  return { ...template.enemyStatuses, ...overrides };
}

export function defaultEnemyMitigation(overrides?: Partial<EnemyMitigation>): EnemyMitigation {
  return { ...EMPTY_ENEMY_MITIGATION, ...overrides };
}

export function defaultCcState(overrides?: Partial<CcState>): CcState {
  return { ...template.playerCC, ...overrides };
}

export function defaultCombatFlags(overrides?: Partial<CombatFlags>): CombatFlags {
  return { ...template.flags, ...overrides };
}

export function defaultTrinketManifest(overrides?: Partial<TrinketManifest>): TrinketManifest {
  return { ...defaultTrinketEffects, ...overrides };
}
