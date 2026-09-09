import { z } from "zod";
import { BattleCardEffectSchema, ENEMY_TYPE_VALUES, keywordDefinitions, type KeywordId } from "@/lib/game-data";
import { GEAR_AFFIX_IDS, GEAR_EFFECT_KEYS, GEAR_RARITIES, GEAR_SLOTS } from "@/lib/gear";
import { EnemyStatusIdSchema } from "@/lib/validation";
import { COMBAT_ENCOUNTER_TRAIT_IDS, REWARD_ENCOUNTER_TRAIT_IDS } from "../content-systems/encounter-traits";
import { defaultTrinketEffects } from "@/lib/trinkets";

const keywordIds = Object.keys(keywordDefinitions) as [KeywordId, ...KeywordId[]];
export const enemyStatusIds = EnemyStatusIdSchema.options;
export const enemyTypes = ENEMY_TYPE_VALUES;

const NonEmptyStringSchema = z.string().min(1);
const PositiveIntegerSchema = z.number().int().positive();
const NonNegativeIntegerSchema = z.number().int().nonnegative();
const KeywordIdSchema = z.enum(keywordIds);

export const CardContentSchema = z.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  descriptionLines: z.array(NonEmptyStringSchema).min(1),
  art: NonEmptyStringSchema,
  cost: NonNegativeIntegerSchema,
  consume: z.boolean().optional(),
  tags: z.array(KeywordIdSchema).optional(),
  effects: z.array(BattleCardEffectSchema),
  excludeFromOfferPool: z.boolean().optional(),
});

export const EnemyContentSchema = z.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  subtitle: NonEmptyStringSchema,
  descriptionLines: z.array(z.string()),
  art: NonEmptyStringSchema,
  enemyType: z.enum(enemyTypes),
  traits: z.array(
    z.object({
      id: NonEmptyStringSchema,
      title: NonEmptyStringSchema,
      description: NonEmptyStringSchema,
    }),
  ),
  abilityIds: z
    .array(NonEmptyStringSchema)
    .length(3)
    .refine((ids) => new Set(ids).size === ids.length, "Enemy abilities must be distinct"),
});

export const CompanionContentSchema = z.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  art: NonEmptyStringSchema,
  turnStartEffects: z.array(BattleCardEffectSchema).min(1),
});

const trinketEffectShape = Object.fromEntries(
  Object.entries(defaultTrinketEffects).map(([key, value]) => [
    key,
    typeof value === "boolean" ? z.boolean() : z.number(),
  ]),
);
const TrinketEffectsContentSchema = z
  .strictObject(trinketEffectShape)
  .partial()
  .refine(
    (effects) =>
      Object.entries(defaultTrinketEffects).some(
        ([key, value]) => effects[key] !== undefined && effects[key] !== value,
      ),
    "Trinket declares no active combat effects",
  );

export const TrinketContentSchema = z.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  descriptionLines: z.array(NonEmptyStringSchema).min(1),
  art: NonEmptyStringSchema,

  effects: TrinketEffectsContentSchema,
});

export const GearDefinitionContentSchema = z.object({
  id: NonEmptyStringSchema,
  baseItemId: NonEmptyStringSchema,
  rarity: z.enum(GEAR_RARITIES).nullable(),
  descriptionLines: z.array(z.string()),
  art: NonEmptyStringSchema,
  compatibleSlots: z.array(z.enum(GEAR_SLOTS)).min(1),
  slotRule: z.enum(["two-handed", "ranged", "quiver", "standard"]),
  affinityKeywords: z.array(KeywordIdSchema).min(1),
  salvageValue: z.record(z.string(), NonNegativeIntegerSchema),
});

export const GearAffixContentSchema = z.object({
  id: z.enum(GEAR_AFFIX_IDS),
  aspect: z.enum(["offensive", "defensive"]),
  keywordId: KeywordIdSchema,
  secondaryKeywordId: KeywordIdSchema.optional(),
  descriptionTemplate: NonEmptyStringSchema,
  effectKey: z.enum(GEAR_EFFECT_KEYS),
  roll: z.record(z.enum(GEAR_RARITIES), z.object({ min: PositiveIntegerSchema, max: PositiveIntegerSchema })),
});

export const EncounterTraitContentSchema = z.object({
  id: z.enum([...COMBAT_ENCOUNTER_TRAIT_IDS, ...REWARD_ENCOUNTER_TRAIT_IDS]),
  category: z.enum(["combat", "reward"]),
  label: NonEmptyStringSchema,
  description: NonEmptyStringSchema,
  modes: z.array(z.enum(["labyrinth", "wildwood"])).min(1),
  enemyTrait: z.object({
    id: NonEmptyStringSchema,
    title: NonEmptyStringSchema,
    description: NonEmptyStringSchema,
  }),
});
