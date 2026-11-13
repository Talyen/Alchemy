import { z } from "zod";
import { BattleCardEffectSchema, ENEMY_TYPE_VALUES, keywordDefinitions, type KeywordId } from "@/lib/game-data";
import { GEAR_AFFIX_IDS, GEAR_EFFECT_KEYS, GEAR_RARITIES, GEAR_SLOTS } from "@/lib/gear";
import { COMBAT_ENCOUNTER_TRAIT_IDS, REWARD_ENCOUNTER_TRAIT_IDS } from "../content-systems/encounter-traits";
import { MATERIAL_IDS } from "@/lib/homestead/types";
import { defaultTrinketEffects } from "@/lib/trinkets";

const keywordIds = Object.keys(keywordDefinitions) as [KeywordId, ...KeywordId[]];

const NonEmptyStringSchema = z.string().refine((value) => value.trim().length > 0, "Text must not be blank");
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
  descriptionLines: z.array(NonEmptyStringSchema),
  art: NonEmptyStringSchema,
  enemyType: z.enum(ENEMY_TYPE_VALUES),
  traits: z
    .array(
      z.object({
        id: NonEmptyStringSchema,
        title: NonEmptyStringSchema,
        description: NonEmptyStringSchema,
        polarity: z.enum(["positive", "negative"]),
      }),
    )
    .length(2)
    .refine(
      (traits) =>
        traits[0]?.polarity === "positive" && traits[1]?.polarity === "negative" && traits[0].id !== traits[1].id,
      "Enemies require one distinct positive and negative native Trait, in that order",
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

export const GearDefinitionContentSchema = z
  .object({
    id: NonEmptyStringSchema,
    displayName: NonEmptyStringSchema,
    baseItemId: NonEmptyStringSchema,
    rarity: z.enum(GEAR_RARITIES),
    descriptionLines: z.array(NonEmptyStringSchema),
    art: NonEmptyStringSchema,
    compatibleSlots: z
      .array(z.enum(GEAR_SLOTS))
      .min(1)
      .refine((slots) => new Set(slots).size === slots.length, "Gear slots must be distinct"),
    slotRule: z.enum(["two-handed", "ranged", "quiver", "standard"]),
    affinityKeywords: z
      .array(KeywordIdSchema)
      .min(1)
      .refine((keywords) => new Set(keywords).size === keywords.length, "Gear affinities must be distinct"),
    salvageValue: z.record(z.enum(MATERIAL_IDS), NonNegativeIntegerSchema),
  })
  .refine(
    (definition) => {
      if (definition.slotRule === "standard") return true;
      const expected = definition.slotRule === "quiver" ? "off-hand" : "main-hand";
      return definition.compatibleSlots.length === 1 && definition.compatibleSlots[0] === expected;
    },
    { error: "Gear slots must match the hand rule", path: ["compatibleSlots"] },
  );

export const GearAffixContentSchema = z
  .object({
    id: z.enum(GEAR_AFFIX_IDS),
    name: NonEmptyStringSchema,
    aspect: z.enum(["offensive", "defensive"]),
    uniqueOnly: z.boolean().optional(),
    keywordId: KeywordIdSchema,
    secondaryKeywordId: KeywordIdSchema.optional(),
    descriptionTemplate: NonEmptyStringSchema,
    effectKey: z.enum(GEAR_EFFECT_KEYS),
    roll: z.record(z.enum(GEAR_RARITIES), z.object({ min: PositiveIntegerSchema, max: PositiveIntegerSchema })),
  })
  .refine((affix) => affix.secondaryKeywordId !== affix.keywordId, {
    error: "Secondary affinity must differ from the primary affinity",
    path: ["secondaryKeywordId"],
  });

export const EncounterTraitContentSchema = z
  .object({
    id: z.enum([...COMBAT_ENCOUNTER_TRAIT_IDS, ...REWARD_ENCOUNTER_TRAIT_IDS]),
    category: z.enum(["combat", "reward"]),
    label: NonEmptyStringSchema,
    description: NonEmptyStringSchema,
    modes: z
      .array(z.enum(["labyrinth", "wildwood"]))
      .min(1)
      .refine((modes) => new Set(modes).size === modes.length, "Encounter modes must be distinct"),
    enemyTrait: z.object({
      id: NonEmptyStringSchema,
      title: NonEmptyStringSchema,
      description: NonEmptyStringSchema,
    }),
  })
  .refine(
    (trait) => {
      const ids: readonly string[] =
        trait.category === "combat" ? COMBAT_ENCOUNTER_TRAIT_IDS : REWARD_ENCOUNTER_TRAIT_IDS;
      return ids.includes(trait.id);
    },
    { error: "Encounter trait category does not match its canonical id", path: ["category"] },
  );
