import { z } from "zod";
import { BattleCardEffectSchema, keywordDefinitions, type KeywordId } from "@/lib/game-data";
import { parseSavedCardDescription } from "./card-description-schema";
import { recordNestedValidationWarnings, type ValidationError } from "./validation-utils";

function parseSavedEffectList(values: unknown[]): {
  values: Array<z.infer<typeof BattleCardEffectSchema>>;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];
  const parsed: Array<z.infer<typeof BattleCardEffectSchema>> = [];
  values.forEach((value, i) => {
    const result = BattleCardEffectSchema.safeParse(value);
    if (result.success) parsed.push({ ...result.data });
    else errors.push({ path: `effects[${i}]`, message: result.error.message });
  });
  return { values: parsed.length === values.length ? parsed : [], errors };
}

function cloneSavedDescriptionLines(values: unknown[]): { values: string[] | null; errors: ValidationError[] } {
  if (!values.every((line) => typeof line === "string")) {
    return { values: null, errors: [{ path: "descriptionLines", message: "contained non-string values" }] };
  }
  return { values: [...values], errors: [] };
}

export type PersistedBattleCard = z.output<typeof BattleCardSchema>;

export const BattleCardSchema = z
  .object({
    id: z.string(),
    uid: z.number().int().optional().catch(undefined),
    title: z.string().catch(""),
    descriptionLines: z.array(z.unknown()).catch([]),
    description: z.unknown().optional(),
    art: z.string().catch(""),
    // -1 marks a corrupt/unparseable cost that survived load repair; runtime
    // treats it as broken data, never as a playable cost.
    cost: z.number().catch(-1),
    consume: z.boolean().optional(),
    corrupted: z.boolean().optional(),
    transmuted: z
      .custom<KeywordId>((value) => typeof value === "string" && Object.hasOwn(keywordDefinitions, value))
      .optional()
      .catch(undefined),
    tags: z
      .array(z.custom<KeywordId>((value) => typeof value === "string" && Object.hasOwn(keywordDefinitions, value)))
      .optional()
      .catch(undefined),
    baseTitle: z.string().optional(),
    effects: z.array(z.unknown()).catch([]),
  })
  .transform((saved) => {
    const described = cloneSavedDescriptionLines(saved.descriptionLines);
    const effects = parseSavedEffectList(saved.effects);
    const bound = parseSavedCardDescription(saved.description, effects.values);
    const cost = Number.isInteger(saved.cost) && saved.cost >= 0 ? saved.cost : -1;
    const result = {
      id: saved.id,
      title: saved.title,
      descriptionLines: bound?.rendered.descriptionLines ?? described.values ?? [],
      ...(bound ? { description: bound.description } : {}),
      art: saved.art,
      cost,
      effects: effects.values,
      ...(saved.uid !== undefined ? { uid: saved.uid } : {}),
      ...(saved.consume !== undefined ? { consume: saved.consume } : {}),
      ...(saved.corrupted !== undefined ? { corrupted: saved.corrupted } : {}),
      ...(saved.transmuted !== undefined ? { transmuted: saved.transmuted } : {}),
      ...(saved.tags !== undefined ? { tags: saved.tags } : {}),
      ...(saved.baseTitle !== undefined ? { baseTitle: saved.baseTitle } : {}),
    };
    recordNestedValidationWarnings([
      ...described.errors,
      ...effects.errors,
      ...(saved.description !== undefined && !bound
        ? [{ path: "description", message: "invalid effect bindings were discarded" }]
        : []),
    ]);
    return result;
  });

export function parseSavedCard(value: unknown, path: string, index: number): PersistedBattleCard | null {
  const result = BattleCardSchema.safeParse(value);
  if (result.success) return result.data;
  recordNestedValidationWarnings([{ path: `${path}[${index}]`, message: "malformed saved card was dropped" }]);
  return null;
}

export function parseSavedCardArray(values: unknown[], path: string): PersistedBattleCard[] {
  const cards: PersistedBattleCard[] = [];
  values.forEach((value, index) => {
    const card = parseSavedCard(value, path, index);
    if (card !== null) cards.push(card);
  });
  return cards;
}

export function savedCardArraySchema(path: string) {
  return z.array(z.unknown()).transform((values) => parseSavedCardArray(values, path));
}
