// All battle card effect kinds — registered by category.
import {
  damageEffectDefinition,
  selfDamageEffectDefinition,
  randomDamageEffectDefinition,
  removeEnemyArmorEffectDefinition,
} from "./damage-schemas";
import {
  playerStatusEffectDefinition,
  enemyStatusEffectDefinition,
  removeHarmfulStatusEffectDefinition,
  removePlayerStatusEffectDefinition,
  multiplyEnemyStatusEffectDefinition,
  cleansePlayerStatusToDamageEffectDefinition,
} from "./status-schemas";
import {
  restoreManaEffectDefinition,
  loseManaEffectDefinition,
  gainMaxManaEffectDefinition,
  loseMaxManaEffectDefinition,
  healEffectDefinition,
  loseHealthEffectDefinition,
} from "./mana-health-schemas";
import { summonCompanionEffectDefinition, buffCompanionEffectDefinition } from "./companion-schemas";
import { gainGoldEffectDefinition, wishEffectDefinition, drawCardsEffectDefinition } from "./utility-schemas";
import {
  nextHitCritEffectDefinition,
  playNextCardTwiceEffectDefinition,
  nextHitPoisonEffectDefinition,
} from "./flag-schemas";

/** Registry entries with Zod schemas (all kinds except chance, which is lazy). */
export const TEMPLATE_EFFECT_DEFINITIONS = [
  damageEffectDefinition,
  playerStatusEffectDefinition,
  enemyStatusEffectDefinition,
  healEffectDefinition,
  restoreManaEffectDefinition,
  loseManaEffectDefinition,
  loseMaxManaEffectDefinition,
  gainMaxManaEffectDefinition,
  gainGoldEffectDefinition,
  wishEffectDefinition,
  summonCompanionEffectDefinition,
  removeHarmfulStatusEffectDefinition,
  removePlayerStatusEffectDefinition,
  selfDamageEffectDefinition,
  buffCompanionEffectDefinition,
  loseHealthEffectDefinition,
  drawCardsEffectDefinition,
  removeEnemyArmorEffectDefinition,
  multiplyEnemyStatusEffectDefinition,
  cleansePlayerStatusToDamageEffectDefinition,
  randomDamageEffectDefinition,
  nextHitCritEffectDefinition,
  playNextCardTwiceEffectDefinition,
  nextHitPoisonEffectDefinition,
] as const;
