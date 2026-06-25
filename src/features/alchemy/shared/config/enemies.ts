// Enemy selection helpers for alchemy run rooms and act bosses.
// Depends on game-data enemies and shared random selection utilities.
import { enemyBestiary, type BestiaryEntry, type EnemyType } from "@/lib/game-data";
import { pickRandom } from "@/lib/utils";

// Picks an enemy for the current room. Room 0 of a run always starts with a
// normal combat encounter without a tutorial guarantee. Subsequent rooms pick
// from normal or elite pools based on the current destination type.
function withoutEncountered(pool: BestiaryEntry[], encounteredEnemyIds: readonly string[]): BestiaryEntry[] {
  if (encounteredEnemyIds.length === 0) return pool;
  const encountered = new Set(encounteredEnemyIds);
  return pool.filter((enemy) => !encountered.has(enemy.id));
}

export function getCurrentEnemy(enemyType?: EnemyType, encounteredEnemyIds: readonly string[] = []): BestiaryEntry {
  const pool = enemyType
    ? enemyBestiary.filter((e) => e.enemyType === enemyType)
    : enemyBestiary.filter((e) => e.id !== "skeleton");
  const available = pool.length > 0 ? pool : enemyBestiary.filter((e) => e.id !== "skeleton");
  const preferred = withoutEncountered(available, encounteredEnemyIds);
  return pickRandom(preferred.length > 0 ? preferred : available) ?? enemyBestiary[0]!;
}

// Returns a random boss enemy from the full boss pool. Each boss can appear in each act.
export function getBossEnemy(encounteredEnemyIds: readonly string[] = []): BestiaryEntry {
  const pool = enemyBestiary.filter((e) => e.enemyType === "boss");
  const preferred = withoutEncountered(pool, encounteredEnemyIds);
  return pickRandom(preferred.length > 0 ? preferred : pool) ?? enemyBestiary[0]!;
}

// Returns a boss by its enemy ID (used by Wildwood boss selection).
export function getBossById(bossId: string): BestiaryEntry | undefined {
  return enemyBestiary.find((e) => e.id === bossId);
}
