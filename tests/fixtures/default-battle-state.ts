import type { PlayerStatusValues, EnemyStatusValues, TrinketManifest, CcState } from "@/lib/battle/types";
import { defaultBattleState } from "@/lib/battle";
import { defaultTrinketEffects } from "@/lib/trinkets";

export function defaultPlayerStatusValues(overrides?: Partial<PlayerStatusValues>): PlayerStatusValues {
  return { ...defaultBattleState().playerStatuses, ...overrides };
}

export function defaultEnemyStatusValues(overrides?: Partial<EnemyStatusValues>): EnemyStatusValues {
  return { ...defaultBattleState().enemyStatuses, ...overrides };
}

export function defaultCcState(overrides?: Partial<CcState>): CcState {
  return { ...defaultBattleState().playerCC, ...overrides };
}

export function defaultTrinketManifest(overrides?: Partial<TrinketManifest>): TrinketManifest {
  return { ...defaultTrinketEffects, ...overrides };
}
