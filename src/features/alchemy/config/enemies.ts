// Enemy selection helpers for alchemy run rooms and act bosses.
// Depends on game-data enemies and shared random selection utilities.
import { enemyBestiary, type BestiaryEntry, type EnemyType } from "@/lib/game-data";
import { pickRandom } from "@/lib/utils";

// Picks an enemy for the current room. Room 0 of a run always starts with a
// normal combat encounter without a tutorial guarantee. Subsequent rooms pick
// from normal or elite pools based on the current destination type.
export function getCurrentEnemy(enemyType?: EnemyType): BestiaryEntry {
  const pool = enemyType ? enemyBestiary.filter((e) => e.enemyType === enemyType) : enemyBestiary.filter((e) => e.id !== "skeleton");
  const available = pool.length > 0 ? pool : enemyBestiary.filter((e) => e.id !== "skeleton");
  return pickRandom(available) ?? enemyBestiary[0];
}

// Returns the boss enemy for a given act. Each act has a unique boss.
export function getBossEnemy(act: number): BestiaryEntry {
  const bossId = act === 1 ? "rusted-colossus" : act === 2 ? "frostwarden" : "blight-treant";
  return enemyBestiary.find((e) => e.id === bossId) ?? enemyBestiary[0];
}

// Returns a boss by its enemy ID (used by Wildwood boss selection).
export function getBossById(bossId: string): BestiaryEntry | undefined {
  return enemyBestiary.find((e) => e.id === bossId);
}
