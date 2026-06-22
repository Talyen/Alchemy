import { z } from "zod";
import { BattleCardEffectSchema, DAMAGE_TYPES, keywordDefinitions, type KeywordId } from "@/lib/game-data";
import { GEAR_AFFIX_IDS, GEAR_EFFECT_KEYS, GEAR_RARITIES, GEAR_SLOTS } from "@/lib/gear";
import { COMBAT_ENCOUNTER_TRAIT_IDS, REWARD_ENCOUNTER_TRAIT_IDS } from "../content-systems/encounter-traits";

const keywordIds = Object.keys(keywordDefinitions) as [KeywordId, ...KeywordId[]];
const playerStatusIds = [
  "block",
  "armor",
  "forge",
  "haste",
  "phoenixFeather",
  "burn",
  "poison",
  "bleed",
  "freeze",
  "stun",
] as const;
export const enemyStatusIds = ["burn", "poison", "bleed", "freeze", "stun"] as const;
export const enemyTypes = ["normal", "elite", "boss"] as const;

const NonEmptyStringSchema = z.string().min(1);
const PositiveIntegerSchema = z.number().int().positive();
const NonNegativeIntegerSchema = z.number().int().nonnegative();
const KeywordIdSchema = z.enum(keywordIds);
const PlayerStatusIdSchema = z.enum(playerStatusIds);
const DamageTypeSchema = z.enum(DAMAGE_TYPES as [string, ...string[]]);

export const CardContentSchema = z.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  descriptionLines: z.array(NonEmptyStringSchema).min(1),
  art: NonEmptyStringSchema,
  cost: NonNegativeIntegerSchema,
  consume: z.boolean().optional(),
  tags: z.array(KeywordIdSchema).optional(),
  effects: z.array(BattleCardEffectSchema),
});

const EnemyAttackEffectSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("damage"),
    damageType: DamageTypeSchema,
    amount: PositiveIntegerSchema,
    lifesteal: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("player-status"),
    status: PlayerStatusIdSchema,
    amount: PositiveIntegerSchema,
  }),
]);

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
  attackEffects: z.array(EnemyAttackEffectSchema).min(1),
});

export const CompanionContentSchema = z.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  art: NonEmptyStringSchema,
  turnStartEffects: z.array(BattleCardEffectSchema).length(1),
});

export const TrinketContentSchema = z.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  descriptionLines: z.array(NonEmptyStringSchema).min(1),
  art: NonEmptyStringSchema,
});

export const GearDefinitionContentSchema = z.object({
  id: NonEmptyStringSchema,
  baseItemId: NonEmptyStringSchema,
  rarity: z.enum(GEAR_RARITIES).nullable(),
  title: NonEmptyStringSchema,
  descriptionLines: z.array(z.string()),
  art: NonEmptyStringSchema,
  compatibleSlots: z.array(z.enum(GEAR_SLOTS)).min(1),
  requiresTwoHands: z.boolean(),
  affinityKeywords: z.array(KeywordIdSchema).min(1),
  salvageValue: z.record(z.string(), NonNegativeIntegerSchema),
  rangedWeapon: z.boolean().optional(),
  quiver: z.boolean().optional(),
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
