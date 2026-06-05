// All battle card effect kinds — register new modules here (see effects/<kind>/definition.ts).
import { buffCompanionEffectDefinition } from "./buff-companion/definition";
import { chanceEffectDefinition } from "./chance/definition";
import { cleansePlayerStatusToDamageEffectDefinition } from "./cleanse-player-status-to-damage/definition";
import { damageEffectDefinition } from "./damage/definition";
import { drawCardsEffectDefinition } from "./draw-cards/definition";
import { enemyStatusEffectDefinition } from "./enemy-status/definition";
import { gainGoldEffectDefinition } from "./gain-gold/definition";
import { gainMaxManaEffectDefinition } from "./gain-max-mana/definition";
import { healEffectDefinition } from "./heal/definition";
import { loseHealthEffectDefinition } from "./lose-health/definition";
import { loseManaEffectDefinition } from "./lose-mana/definition";
import { loseMaxManaEffectDefinition } from "./lose-max-mana/definition";
import { multiplyEnemyStatusEffectDefinition } from "./multiply-enemy-status/definition";
import { playerStatusEffectDefinition } from "./player-status/definition";
import { randomDamageEffectDefinition } from "./random-damage/definition";
import { removeEnemyArmorEffectDefinition } from "./remove-enemy-armor/definition";
import { removeHarmfulStatusEffectDefinition } from "./remove-harmful-status/definition";
import { removePlayerStatusEffectDefinition } from "./remove-player-status/definition";
import { restoreManaEffectDefinition } from "./restore-mana/definition";
import { selfDamageEffectDefinition } from "./self-damage/definition";
import { summonCompanionEffectDefinition } from "./summon-companion/definition";
import { wishEffectDefinition } from "./wish/definition";
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
