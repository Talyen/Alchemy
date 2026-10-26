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
import { pickRandom } from "@/lib/rng";

export { enemyById, isEnemyId };

function resolveEnemyFallback(): BestiaryEntry {
  const fallback = enemyBestiary[0];
  if (!fallback) throw new Error("Enemy bestiary is empty");
  return fallback;
}

function selectEnemy(pool: readonly BestiaryEntry[], encounteredEnemyIds: readonly string[], rng?: () => number) {
  const encountered = new Set(encounteredEnemyIds);
  const preferred = pool.filter((enemy) => !encountered.has(enemy.id));
  const candidates = preferred.length > 0 ? preferred : pool;
  return (rng ? pickRandom(candidates, rng) : candidates[0]) ?? resolveEnemyFallback();
}

export function getCurrentEnemy(
  enemyType?: EnemyType,
  encounteredEnemyIds: readonly string[] = [],
  rng?: () => number,
): BestiaryEntry {
  const pool: readonly BestiaryEntry[] = enemyType ? enemiesByType[enemyType] : encounterEnemies;
  return selectEnemy(pool.length > 0 ? pool : encounterEnemies, encounteredEnemyIds, rng);
}

export function getBossEnemy(encounteredEnemyIds: readonly string[] = [], rng?: () => number): BestiaryEntry {
  return selectEnemy(bossEnemies, encounteredEnemyIds, rng);
}

export function getBossById(bossId: string): BestiaryEntry | undefined {
  if (!isEnemyId(bossId)) return undefined;
  const enemy = enemyById[bossId];
  return enemy.enemyType === "boss" ? enemy : undefined;
}

export function rollFreshBossId(rng?: () => number): string {
  return getBossEnemy([], rng).id;
}
