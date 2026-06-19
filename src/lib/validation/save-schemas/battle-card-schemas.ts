// Zod schemas for persisted battle cards; effect shapes live in @/lib/game-data/effects.
import { z } from "zod";
import { BattleCardEffectSchema } from "@/lib/game-data";
import { pushValidationError } from "./validation-utils";

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

export { BattleCardEffectSchema };

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
      effects: savedEffects.effects,
      effectsFullyValid: savedEffects.fullyValid,
      descriptionLinesFullyValid: savedDescriptionLines !== null,
    };
  });
