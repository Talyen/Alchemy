import { z } from "zod";
import { BattleCardEffectSchema } from "@/lib/game-data";
import { recordNestedValidationWarnings, type ValidationError } from "./validation-utils";

function parseSavedEffectList(values: unknown[]): {
  values: Array<z.infer<typeof BattleCardEffectSchema>>;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];
  const parsed = values.flatMap((value, i) => {
    const result = BattleCardEffectSchema.safeParse(value);
    if (!result.success) {
      errors.push({ path: `effects[${i}]`, message: result.error.message });
    }
    return result.success ? [{ ...result.data }] : [];
  });
  return { values: parsed.length === values.length ? parsed : [], errors };
}

function cloneSavedDescriptionLines(values: unknown[]): { values: string[] | null; errors: ValidationError[] } {
  const allStrings = values.every((line) => typeof line === "string");
  if (!allStrings) {
    return { values: null, errors: [{ path: "descriptionLines", message: "contained non-string values" }] };
  }
  return { values: [...values] as string[], errors: [] };
}

export { BattleCardEffectSchema };

export type PersistedBattleCard = z.output<typeof BattleCardSchema>;

export const BattleCardSchema = z
  .object({
    id: z.string(),
    uid: z.number().int().optional(),
    title: z.string().default(""),
    descriptionLines: z.array(z.unknown()).catch([]),
    art: z.string().default(""),
    // -1 marks a corrupt/unparseable cost that survived load repair; runtime
    // treats it as broken data, never as a playable cost.
    cost: z.number().catch(-1),
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
    effects: z.array(z.unknown()).catch([]),
  })
  .transform((saved) => {
    const described = cloneSavedDescriptionLines(saved.descriptionLines);
    const effects = parseSavedEffectList(saved.effects);
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
    const cost = Number.isInteger(saved.cost) && saved.cost >= 0 ? saved.cost : -1;
    const result = {
      id: saved.id,
      title: saved.title,
      descriptionLines: described.values ?? [],
      art: saved.art,
      cost,
      effects: effects.values,
      ...(saved.uid !== undefined ? { uid: saved.uid } : {}),
      ...(saved.consume !== undefined ? { consume: saved.consume } : {}),
      ...(saved.corrupted !== undefined ? { corrupted: saved.corrupted } : {}),
      ...(saved.baseTitle !== undefined ? { baseTitle: saved.baseTitle } : {}),
      ...(corruptedValuePositions && corruptedValuePositions.length > 0 ? { corruptedValuePositions } : {}),
    };
    recordNestedValidationWarnings(result, [...described.errors, ...effects.errors]);
    return result;
  });
