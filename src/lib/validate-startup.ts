// Startup validation: asserts critical game constants are positive and data arrays
// are non-empty. Runs once at import time via main.tsx. Only fires console.error
// on failure — does not block the game from loading.
import {
  BASE_ENEMY_HEALTH,
  BASE_PLAYER_MANA,
  CARDS_PER_TURN,
  MAX_HAND_SIZE,
  MAX_PLAYER_HEALTH,
  MIN_MAX_MANA_FLOOR,
  STARTING_TURN,
} from "./game-constants";
import { enemyBestiary, cardLibrary } from "./game-data";

const checks: { name: string; ok: boolean }[] = [];

function check(name: string, condition: boolean) {
  checks.push({ name, ok: condition });
  if (!condition) console.error(`Startup validation FAILED: ${name}`);
}

check("CARDS_PER_TURN > 0", CARDS_PER_TURN > 0);
check("MAX_HAND_SIZE > 0", MAX_HAND_SIZE > 0);
check("MAX_PLAYER_HEALTH > 0", MAX_PLAYER_HEALTH > 0);
check("BASE_ENEMY_HEALTH > 0", BASE_ENEMY_HEALTH > 0);
check("BASE_PLAYER_MANA >= 0", BASE_PLAYER_MANA >= 0);
check("STARTING_TURN > 0", STARTING_TURN > 0);
check("MIN_MAX_MANA_FLOOR > 0", MIN_MAX_MANA_FLOOR > 0);
check("enemyBestiary is non-empty", enemyBestiary.length > 0);
check("cardLibrary is non-empty", cardLibrary.length > 0);

if (checks.some((c) => !c.ok)) {
  console.error(`${checks.filter((c) => !c.ok).length} startup checks failed — game may behave unexpectedly`);
}
