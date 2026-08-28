import { getOfferableCardPool } from "./game-data/cards/card-pools";
import { companionLibrary, enemyBestiary, cardLibrary } from "./game-data";
import { collectUncoveredDifficultyModifierKinds, collectUncoveredEnemyTraitIds } from "./battle/enemy-turn-traits";
import { logError } from "./error-logger";

export function runStartupValidation() {
  const checks: Array<{ name: string; ok: boolean }> = [];

  function check(name: string, condition: boolean) {
    checks.push({ name, ok: condition });
    if (!condition) logError(`Startup validation FAILED: ${name}`, "validation");
  }

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
