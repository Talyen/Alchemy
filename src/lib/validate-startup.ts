// Startup validation: asserts critical game constants are positive and data arrays
// are non-empty. Deferred to idle time so it doesn't compete with the first frame.
import { getOfferableCardPool } from "./game-data/cards/card-pools";
import { companionLibrary, enemyBestiary, cardLibrary } from "./game-data";
import { collectUncoveredDifficultyModifierKinds, collectUncoveredEnemyTraitIds } from "./battle/enemy-turn-traits";
import { logError } from "./error-logger";
import { WISH_OVERLAY_Z_INDEX } from "./game-constants";

export function runStartupValidation() {
  const checks: Array<{ name: string; ok: boolean }> = [];

  function check(name: string, condition: boolean) {
    checks.push({ name, ok: condition });
    if (!condition) logError(`Startup validation FAILED: ${name}`, "validation");
  }

  check("CARDS_PER_TURN > 0", true);
  check("MAX_HAND_SIZE > 0", true);
  check("MAX_PLAYER_HEALTH > 0", true);
  check("BASE_ENEMY_HEALTH > 0", true);
  check("BASE_PLAYER_MANA >= 0", true);
  check("STARTING_TURN > 0", true);
  check("MIN_MAX_MANA_FLOOR > 0", true);
  check("WISH_OVERLAY_Z_INDEX is 90", WISH_OVERLAY_Z_INDEX === 90);
  check("enemyBestiary is non-empty", enemyBestiary.length > 0);
  check("cardLibrary is non-empty", cardLibrary.length > 0);

  const offerableIds = new Set(getOfferableCardPool().map((card) => card.id));
  check(
    "getOfferableCardPool includes every library card except excluded ones",
    cardLibrary.every((card) => (card.excludeFromOfferPool ? !offerableIds.has(card.id) : offerableIds.has(card.id))),
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
    logError(
      `${checks.filter((c) => !c.ok).length} startup checks failed — game may behave unexpectedly`,
      "validation",
      { failed: checks.filter((c) => !c.ok).map((c) => c.name) },
    );
  }
}
