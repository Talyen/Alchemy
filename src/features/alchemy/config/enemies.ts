// Enemy selection helpers for alchemy run rooms and act bosses.
// Depends on game-data enemies and shared random selection utilities.
import { enemyBestiary, type EnemyType } from "@/lib/game-data";
import { pickRandom } from "@/lib/utils";

// Picks an enemy for the current room. Room 0 of a run always starts with the
// Skeleton as a tutorial fight. Subsequent rooms pick from normal or elite pools
// based on the current destination type.
export function getCurrentEnemy(roomsEncountered: number, enemyType?: EnemyType) {
  if (roomsEncountered === 0) {
    return enemyBestiary.find((e) => e.id === "skeleton") ?? enemyBestiary[0];
  }
  const pool = enemyType ? enemyBestiary.filter((e) => e.enemyType === enemyType) : enemyBestiary.filter((e) => e.id !== "skeleton");
  const available = pool.length > 0 ? pool : enemyBestiary.filter((e) => e.id !== "skeleton");
  return pickRandom(available) ?? enemyBestiary[0];
}

// Returns the boss enemy for a given act. Each act has a unique boss.
export function getBossEnemy(act: number) {
  const bossId = act === 1 ? "rusted-colossus" : act === 2 ? "frostwarden" : "blight-treant";
  return enemyBestiary.find((e) => e.id === bossId) ?? enemyBestiary[0];
}
