import type { PlayerStatusValues, EnemyStatusValues, TrinketManifest, CcState } from "@/lib/battle/types";
import { defaultBattleState } from "@/lib/battle";
import { defaultTrinketEffects } from "@/lib/trinkets";

const { playerStatuses, enemyStatuses, playerCC } = defaultBattleState();

export function defaultPlayerStatusValues(overrides?: Partial<PlayerStatusValues>): PlayerStatusValues {
  return { ...playerStatuses, ...overrides };
}

export function defaultEnemyStatusValues(overrides?: Partial<EnemyStatusValues>): EnemyStatusValues {
  return { ...enemyStatuses, ...overrides };
}

export function defaultCcState(overrides?: Partial<CcState>): CcState {
  return { ...playerCC, ...overrides };
}

export function defaultTrinketManifest(overrides?: Partial<TrinketManifest>): TrinketManifest {
  return { ...defaultTrinketEffects, ...overrides };
}
