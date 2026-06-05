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
  WISH_OVERLAY_Z_INDEX,
} from "./game-constants";
import { companionLibrary, enemyBestiary, cardLibrary, getOfferableCardPool } from "./game-data";
import { MIXED_POTION_CARD_ID } from "./game-constants";
import { collectUncoveredDifficultyModifierKinds, collectUncoveredEnemyTraitIds } from "./battle/enemy-turn-traits";
import { logError } from "./error-logger";

const checks: { name: string; ok: boolean }[] = [];

function check(name: string, condition: boolean) {
  checks.push({ name, ok: condition });
  if (!condition) logError(`Startup validation FAILED: ${name}`, "validation");
}

check("CARDS_PER_TURN > 0", CARDS_PER_TURN > 0);
check("MAX_HAND_SIZE > 0", MAX_HAND_SIZE > 0);
check("MAX_PLAYER_HEALTH > 0", MAX_PLAYER_HEALTH > 0);
check("BASE_ENEMY_HEALTH > 0", BASE_ENEMY_HEALTH > 0);
check("BASE_PLAYER_MANA >= 0", BASE_PLAYER_MANA >= 0);
// STARTING_TURN is the turn-counter value for the first player turn (expected: 1).
// It must be positive so turn-number display ("Turn 1") is human-readable, not zero-indexed.
check("STARTING_TURN > 0", STARTING_TURN > 0);
check("MIN_MAX_MANA_FLOOR > 0", MIN_MAX_MANA_FLOOR > 0);
// Must match --z-wish-overlay in src/index.css (.z-wish-overlay).
check("WISH_OVERLAY_Z_INDEX is 90", WISH_OVERLAY_Z_INDEX === 90);
check("enemyBestiary is non-empty", enemyBestiary.length > 0);
check("cardLibrary is non-empty", cardLibrary.length > 0);

const offerableIds = new Set(getOfferableCardPool().map((card) => card.id));
check(
  "getOfferableCardPool includes every library card except mixed potion",
  cardLibrary.every((card) =>
    card.id === MIXED_POTION_CARD_ID ? !offerableIds.has(card.id) : offerableIds.has(card.id),
  ),
);

for (const [companionId, companion] of Object.entries(companionLibrary)) {
  check(`companion ${companionId} has exactly one turn-start effect`, companion.turnStartEffects.length === 1);
}

const bestiaryTraitIds = enemyBestiary.flatMap((enemy) => enemy.traits.map((trait) => trait.id));
const uncoveredTraits = collectUncoveredEnemyTraitIds(bestiaryTraitIds);
check("enemy traits have turn-start handler or passive-only entry", uncoveredTraits.length === 0);

const uncoveredModifiers = collectUncoveredDifficultyModifierKinds();
check("difficulty modifiers have turn-start handler or passive-only entry", uncoveredModifiers.length === 0);

if (checks.some((c) => !c.ok)) {
  logError(`${checks.filter((c) => !c.ok).length} startup checks failed — game may behave unexpectedly`, "validation", {
    failed: checks.filter((c) => !c.ok).map((c) => c.name),
  });
}
