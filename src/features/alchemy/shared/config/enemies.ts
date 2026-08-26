// Enemy selection helpers for alchemy run rooms and act bosses.
import {
  bossEnemies,
  encounterEnemies,
  enemiesByType,
  enemyBestiary,
  enemyById,
  isEnemyId,
  type BestiaryEntry,
  type EnemyType,
} from "@/features/alchemy/shared/config/game-data-catalog";
import { pickRandom } from "@/lib/utils";

// Picks an enemy for the current room. Room 0 of a run always starts with a
// normal combat encounter without a tutorial guarantee. Subsequent rooms pick
// from normal or elite pools based on the current destination type.
function withoutEncountered(pool: readonly BestiaryEntry[], encounteredEnemyIds: readonly string[]): BestiaryEntry[] {
  if (encounteredEnemyIds.length === 0) return [...pool];
  const encountered = new Set(encounteredEnemyIds);
  return pool.filter((enemy) => !encountered.has(enemy.id));
}

export { enemyById, isEnemyId };

export function getCurrentEnemy(
  enemyType?: EnemyType,
  encounteredEnemyIds: readonly string[] = [],
  rng?: () => number,
): BestiaryEntry {
  const pool: readonly BestiaryEntry[] = enemyType ? enemiesByType[enemyType] : encounterEnemies;
  const available = pool.length > 0 ? pool : encounterEnemies;
  const preferred = withoutEncountered(available, encounteredEnemyIds);
  const candidates = preferred.length > 0 ? preferred : available;
  return (rng ? pickRandom(candidates, rng) : candidates[0]) ?? enemyBestiary[0]!;
}

// Returns a random boss enemy from the full boss pool. Each boss can appear in each act.
export function getBossEnemy(encounteredEnemyIds: readonly string[] = [], rng?: () => number): BestiaryEntry {
  const pool = bossEnemies;
  const preferred = withoutEncountered(pool, encounteredEnemyIds);
  const candidates = preferred.length > 0 ? preferred : pool;
  return (rng ? pickRandom(candidates, rng) : candidates[0]) ?? enemyBestiary[0]!;
}

// Returns a boss by its enemy ID (used by Wildwood boss selection).
export function getBossById(bossId: string): BestiaryEntry | undefined {
  if (!isEnemyId(bossId)) return undefined;
  const enemy = enemyById[bossId];
  return enemy.enemyType === "boss" ? enemy : undefined;
}

// Destination offers roll without encounter memory; only battle-init passes history to getBossEnemy.
export function rollFreshBossId(rng?: () => number): string {
  return getBossEnemy([], rng).id;
}
