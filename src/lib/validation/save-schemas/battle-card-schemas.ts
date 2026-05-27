// Zod schemas for persisted battle cards and card effects.
import { z } from "zod";
import type { BattleCardEffect } from "@/lib/game-data";
import { CompanionIdSchema, DamageTypeSchema, EnemyStatusIdSchema } from "./schema-enums";
import { pushValidationError } from "./validation-utils";

const DamageEffectSchema = z.object({
  kind: z.literal("damage"),
  damageType: DamageTypeSchema,
  amount: z.number().finite(),
  lifesteal: z.boolean().optional(),
  equalToBlock: z.boolean().optional(),
  equalToArmor: z.boolean().optional(),
  equalToGoldPercent: z.number().finite().optional(),
});

const PlayerStatusEffectSchema = z.object({
  kind: z.literal("player-status"),
  status: z.enum(["block", "armor", "forge", "haste"]),
  amount: z.number().finite(),
});

const HealEffectSchema = z.object({ kind: z.literal("heal"), amount: z.number().finite() });
const RestoreManaEffectSchema = z.object({ kind: z.literal("restore-mana"), amount: z.number().finite() });
const LoseManaEffectSchema = z.object({ kind: z.literal("lose-mana"), amount: z.number().finite() });
const LoseMaxManaEffectSchema = z.object({ kind: z.literal("lose-max-mana"), amount: z.number().finite() });
const GainMaxManaEffectSchema = z.object({ kind: z.literal("gain-max-mana"), amount: z.number().finite() });
const GainGoldEffectSchema = z.object({ kind: z.literal("gain-gold"), amount: z.number().finite() });
const WishEffectSchema = z.object({ kind: z.literal("wish"), amount: z.number().finite() });

const SummonCompanionEffectSchema = z.object({
  kind: z.literal("summon-companion"),
  companionId: CompanionIdSchema,
});

const RemoveHarmfulStatusEffectSchema = z.object({
  kind: z.literal("remove-harmful-status"),
  amount: z.number().finite(),
});

const SelfDamageEffectSchema = z.object({
  kind: z.literal("self-damage"),
  damageType: EnemyStatusIdSchema,
  amount: z.number().finite(),
});

const BuffCompanionEffectSchema = z.object({ kind: z.literal("buff-companion"), amount: z.number().finite() });

const RemovePlayerStatusEffectSchema = z.object({
  kind: z.literal("remove-player-status"),
  status: EnemyStatusIdSchema,
});

const LoseHealthEffectSchema = z.object({
  kind: z.literal("lose-health"),
  amount: z.number().finite(),
});

const DrawCardsEffectSchema = z.object({
  kind: z.literal("draw-cards"),
  amount: z.number().finite(),
});

const RemoveEnemyArmorEffectSchema = z.object({
  kind: z.literal("remove-enemy-armor"),
  amount: z.number().finite(),
});

const MultiplyEnemyStatusEffectSchema = z.object({
  kind: z.literal("multiply-enemy-status"),
  status: EnemyStatusIdSchema,
  factor: z.number().finite(),
});

const CleansePlayerStatusToDamageEffectSchema = z.object({
  kind: z.literal("cleanse-player-status-to-damage"),
  status: z.literal("burn"),
  damageType: DamageTypeSchema,
  removeAll: z.boolean().optional(),
});

const RandomDamageEffectSchema = z.object({
  kind: z.literal("random-damage"),
  minAmount: z.number().finite(),
  maxAmount: z.number().finite(),
});

export const BattleCardEffectSchema = z.discriminatedUnion("kind", [
  DamageEffectSchema,
  PlayerStatusEffectSchema,
  HealEffectSchema,
  RestoreManaEffectSchema,
  LoseManaEffectSchema,
  LoseMaxManaEffectSchema,
  GainMaxManaEffectSchema,
  GainGoldEffectSchema,
  WishEffectSchema,
  SummonCompanionEffectSchema,
  RemoveHarmfulStatusEffectSchema,
  SelfDamageEffectSchema,
  BuffCompanionEffectSchema,
  RemovePlayerStatusEffectSchema,
  LoseHealthEffectSchema,
  DrawCardsEffectSchema,
  RemoveEnemyArmorEffectSchema,
  MultiplyEnemyStatusEffectSchema,
  CleansePlayerStatusToDamageEffectSchema,
  RandomDamageEffectSchema,
]);

function parseSavedEffectList(values: unknown[]) {
  const effects = values.flatMap((value, i) => {
    const result = BattleCardEffectSchema.safeParse(value);
    if (!result.success) {
      pushValidationError(`effects[${i}]`, result.error.message);
      console.warn(`[Save Validation] Card effect at index ${i} dropped:`, result.error.message);
    }
    return result.success ? [{ ...result.data }] : [];
  });
  return { effects, fullyValid: effects.length === values.length };
}

function cloneSavedDescriptionLines(values: unknown[]): string[] | null {
  const allStrings = values.every((line) => typeof line === "string");
  if (!allStrings) {
    pushValidationError("descriptionLines", "contained non-string values");
    console.warn(`[Save Validation] Card description lines contained non-string values`);
  }
  return allStrings ? [...values] : null;
}

export const BattleCardSchema = z
  .object({
    id: z.string(),
    uid: z.number().int().optional(),
    title: z.string(),
    descriptionLines: z.array(z.unknown()).optional(),
    art: z.string(),
    cost: z.union([z.number(), z.nan()]).catch(-1),
    consume: z.boolean().optional(),
    corrupted: z.boolean().optional(),
    corruptedValuePositions: z
      .array(
        z
          .object({
            lineIndex: z.number().int().nonnegative().catch(0),
            matchIndex: z.number().int().nonnegative().catch(0),
          })
          .nullable()
          .catch(null),
      )
      .optional(),
    baseTitle: z.string().optional(),
    effects: z.array(z.unknown()).optional(),
  })
  .transform((saved) => {
    const savedDescriptionLines = saved.descriptionLines ? cloneSavedDescriptionLines(saved.descriptionLines) : null;
    const savedEffects = saved.effects ? parseSavedEffectList(saved.effects) : { effects: [], fullyValid: false };
    const corruptedValuePositions = Array.isArray(saved.corruptedValuePositions)
      ? saved.corruptedValuePositions.filter(
          (p) =>
            p &&
            typeof p === "object" &&
            Number.isInteger(p.lineIndex) &&
            Number.isInteger(p.matchIndex) &&
            p.lineIndex >= 0 &&
            p.matchIndex >= 0,
        )
      : undefined;
    const cost =
      Number.isFinite(saved.cost) && Number.isInteger(saved.cost) && saved.cost >= 0 ? Math.floor(saved.cost) : -1;
    return {
      id: saved.id,
      uid: saved.uid,
      title: saved.title,
      descriptionLines: savedDescriptionLines ?? [],
      art: saved.art,
      cost,
      consume: saved.consume,
      corrupted: saved.corrupted,
      baseTitle: saved.baseTitle,
      corruptedValuePositions:
        corruptedValuePositions && corruptedValuePositions.length > 0 ? corruptedValuePositions : undefined,
      effects: savedEffects.effects as BattleCardEffect[],
      effectsFullyValid: savedEffects.fullyValid,
      descriptionLinesFullyValid: savedDescriptionLines !== null,
    };
  });
