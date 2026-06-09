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
import { chanceEffectDefinition } from "./chance/definition";
import type { EffectDispatchRoute } from "./dispatch-routes";
import type { BattleCardEffectKind } from "./kinds";

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
] as const;

/** Dispatch metadata for every kind, including chance. */
export const ALL_EFFECT_REGISTRY_ENTRIES: readonly {
  kind: BattleCardEffectKind;
  dispatchRoute: EffectDispatchRoute;
}[] = [...TEMPLATE_EFFECT_DEFINITIONS, chanceEffectDefinition];
