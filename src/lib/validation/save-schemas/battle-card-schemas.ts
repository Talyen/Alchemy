import { z } from "zod";
import { BattleCardEffectSchema } from "@/lib/game-data";
import { pushValidationError } from "./validation-utils";

function parseSavedEffectList(values: unknown[]) {
  return values.flatMap((value, i) => {
    const result = BattleCardEffectSchema.safeParse(value);
    if (!result.success) {
      pushValidationError(`effects[${i}]`, result.error.message);
      console.warn(`[Save Validation] Card effect at index ${i} dropped:`, result.error.message);
    }
    return result.success ? [{ ...result.data }] : [];
  });
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
    title: z.string().default(""),
    descriptionLines: z.array(z.unknown()).optional(),
    art: z.string().default(""),
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
    const savedEffects = saved.effects ? parseSavedEffectList(saved.effects) : [];
    const corruptedValuePositions = Array.isArray(saved.corruptedValuePositions)
      ? saved.corruptedValuePositions.filter(
          (p): p is { lineIndex: number; matchIndex: number } =>
            p !== null &&
            typeof p === "object" &&
            Number.isInteger(p.lineIndex) &&
            Number.isInteger(p.matchIndex) &&
            p.lineIndex >= 0 &&
            p.matchIndex >= 0,
        )
      : undefined;
    const cost =
      Number.isFinite(saved.cost) && Number.isInteger(saved.cost) && saved.cost >= 0 ? Math.round(saved.cost) : -1;
    return {
      id: saved.id,
      title: saved.title,
      descriptionLines: savedDescriptionLines ?? [],
      art: saved.art,
      cost,
      effects: savedEffects,
      ...(saved.uid !== undefined ? { uid: saved.uid } : {}),
      ...(saved.consume !== undefined ? { consume: saved.consume } : {}),
      ...(saved.corrupted !== undefined ? { corrupted: saved.corrupted } : {}),
      ...(saved.baseTitle !== undefined ? { baseTitle: saved.baseTitle } : {}),
      ...(corruptedValuePositions && corruptedValuePositions.length > 0 ? { corruptedValuePositions } : {}),
    };
  });
