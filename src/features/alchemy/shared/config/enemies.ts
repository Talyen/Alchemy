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

export function getBossEnemy(encounteredEnemyIds: readonly string[] = [], rng?: () => number): BestiaryEntry {
  const pool = bossEnemies;
  const preferred = withoutEncountered(pool, encounteredEnemyIds);
  const candidates = preferred.length > 0 ? preferred : pool;
  return (rng ? pickRandom(candidates, rng) : candidates[0]) ?? enemyBestiary[0]!;
}

export function getBossById(bossId: string): BestiaryEntry | undefined {
  if (!isEnemyId(bossId)) return undefined;
  const enemy = enemyById[bossId];
  return enemy.enemyType === "boss" ? enemy : undefined;
}

export function rollFreshBossId(rng?: () => number): string {
  return getBossEnemy([], rng).id;
}
