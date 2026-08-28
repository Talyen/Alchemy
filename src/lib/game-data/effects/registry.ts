// Unified registry for battle card effect kinds and schemas.
// Consolidates the former definition/kinds/schemas/recursive/template-definitions layers
// so adding a new effect touches only its category schema file and this registry array.
import { z } from "zod";
import type { BattleCardEffect } from "../types";
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

export interface EffectKindDefinition<K extends BattleCardEffect["kind"] = BattleCardEffect["kind"]> {
  kind: K;
  schema: z.ZodType;
}

/** Registry of non-recursive effect kinds (chance/repeat-over-turns are lazy). */
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

export const RECURSIVE_BATTLE_CARD_EFFECT_KINDS = ["chance", "repeat-over-turns"] as const;

type TemplateKind = (typeof TEMPLATE_EFFECT_DEFINITIONS)[number]["kind"];
type RecursiveKind = (typeof RECURSIVE_BATTLE_CARD_EFFECT_KINDS)[number];
export type BattleCardEffectKind = TemplateKind | RecursiveKind;

export const BATTLE_CARD_EFFECT_KINDS = [
  ...TEMPLATE_EFFECT_DEFINITIONS.map((def) => def.kind),
  ...RECURSIVE_BATTLE_CARD_EFFECT_KINDS,
] as const satisfies readonly BattleCardEffectKind[];

// Recursive factories
function createChanceEffectSchema(getEffectSchema: () => z.ZodType<BattleCardEffect>) {
  return z.object({
    kind: z.literal("chance"),
    probability: z.number().min(0).max(1),
    successEffects: z.array(z.lazy(getEffectSchema)),
    failureEffects: z.array(z.lazy(getEffectSchema)),
  });
}

function createRepeatOverTurnsEffectSchema(getEffectSchema: () => z.ZodType<BattleCardEffect>) {
  return z.object({
    kind: z.literal("repeat-over-turns"),
    remainingTurns: z.number().int().min(1).max(10),
    effects: z.array(z.lazy(getEffectSchema)),
  });
}

// Discriminated union composition
type DiscriminableKindSchema = z.core.$ZodTypeDiscriminable<"kind">;

function getTemplateEffectSchemas(): [DiscriminableKindSchema, ...DiscriminableKindSchema[]] {
  const [first, ...rest] = TEMPLATE_EFFECT_DEFINITIONS;
  return [first.schema, ...rest.map((def) => def.schema)];
}

const templateEffectSchemas = getTemplateEffectSchemas();
const BattleCardEffectSchemaBase = z.discriminatedUnion("kind", templateEffectSchemas);

export const BattleCardEffectSchema: z.ZodType<BattleCardEffect> = z.lazy(() => {
  const ChanceEffectSchema = createChanceEffectSchema(() => BattleCardEffectSchema);
  const RepeatOverTurnsEffectSchema = createRepeatOverTurnsEffectSchema(() => BattleCardEffectSchema);
  return z.union([BattleCardEffectSchemaBase, ChanceEffectSchema, RepeatOverTurnsEffectSchema]);
}) as z.ZodType<BattleCardEffect>;
