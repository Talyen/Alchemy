import { z } from "zod";
import { BattleCardEffectSchema, renderCardDescription } from "@/lib/game-data";
import { parseSavedCardDescription } from "./card-description-schema";
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
  if (!values.every((line) => typeof line === "string")) {
    return { values: null, errors: [{ path: "descriptionLines", message: "contained non-string values" }] };
  }
  return { values: [...values], errors: [] };
}

export { BattleCardEffectSchema };

export type PersistedBattleCard = z.output<typeof BattleCardSchema>;

export const BattleCardSchema = z
  .object({
    id: z.string(),
    uid: z.number().int().optional(),
    title: z.string().default(""),
    descriptionLines: z.array(z.unknown()).catch([]),
    description: z.unknown().optional(),
    art: z.string().default(""),
    // -1 marks a corrupt/unparseable cost that survived load repair; runtime
    // treats it as broken data, never as a playable cost.
    cost: z.number().catch(-1),
    consume: z.boolean().optional(),
    corrupted: z.boolean().optional(),
    brewed: z.boolean().optional(),
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
    const description = parseSavedCardDescription(saved.description, effects.values);
    const rendered = description ? renderCardDescription(effects.values, description) : undefined;
    const corruptedValuePositions = saved.corruptedValuePositions?.filter((position) => position !== null);
    const cost = Number.isInteger(saved.cost) && saved.cost >= 0 ? saved.cost : -1;
    const result = {
      id: saved.id,
      title: saved.title,
      descriptionLines: rendered?.descriptionLines ?? described.values ?? [],
      ...(description ? { description } : {}),
      art: saved.art,
      cost,
      effects: effects.values,
      ...(saved.uid !== undefined ? { uid: saved.uid } : {}),
      ...(saved.consume !== undefined ? { consume: saved.consume } : {}),
      ...(saved.brewed !== undefined ? { brewed: saved.brewed } : {}),
      ...(saved.corrupted !== undefined ? { corrupted: saved.corrupted } : {}),
      ...(saved.baseTitle !== undefined ? { baseTitle: saved.baseTitle } : {}),
      ...(rendered
        ? rendered.corruptedValuePositions.length
          ? { corruptedValuePositions: rendered.corruptedValuePositions }
          : {}
        : corruptedValuePositions && corruptedValuePositions.length > 0
          ? { corruptedValuePositions }
          : {}),
    };
    recordNestedValidationWarnings([
      ...described.errors,
      ...effects.errors,
      ...(saved.description !== undefined && !description
        ? [{ path: "description", message: "invalid effect bindings were discarded" }]
        : []),
    ]);
    return result;
  });

export function parseSavedCardEntries(
  values: unknown[],
  path: string,
): Array<{ card: PersistedBattleCard; index: number }> {
  const cards: Array<{ card: PersistedBattleCard; index: number }> = [];
  values.forEach((value, index) => {
    const result = BattleCardSchema.safeParse(value);
    if (result.success) {
      cards.push({ card: result.data, index });
    } else {
      recordNestedValidationWarnings([{ path: `${path}[${index}]`, message: "malformed saved card was dropped" }]);
    }
  });
  return cards;
}

export function parseSavedCardArray(values: unknown[], path: string): PersistedBattleCard[] {
  return parseSavedCardEntries(values, path).map(({ card }) => card);
}

export function savedCardArraySchema(path: string) {
  return z.array(z.unknown()).transform((values) => parseSavedCardArray(values, path));
}
