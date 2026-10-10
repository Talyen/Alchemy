import { z } from "zod";
import {
  BATTLE_CARD_EFFECT_KINDS,
  CARD_MAGNITUDE_FORMATS,
  CARD_MAGNITUDE_FIELDS,
  renderCardDescription,
  type BattleCardEffect,
  type CardDescription,
} from "@/lib/game-data";

const referenceSchema = z.object({
  effectIndex: z.number().int().nonnegative(),
  effectPath: z.array(z.number().int().nonnegative()).optional(),
  kind: z.enum(BATTLE_CARD_EFFECT_KINDS),
  field: z.enum(CARD_MAGNITUDE_FIELDS),
  multiplier: z.union([z.literal(1), z.literal(2)]).optional(),
});

const descriptionSchema = z
  .array(
    z.object({
      role: z.enum(["effect", "keyword", "consume"]),
      parts: z.array(
        z.union([
          z.string(),
          z.object({
            kind: z.literal("magnitude"),
            id: z.string().min(1),
            references: z.array(referenceSchema).min(1),
            format: z.enum(CARD_MAGNITUDE_FORMATS).optional(),
            editable: z.boolean().optional(),
            corrupted: z.boolean().optional(),
            distilled: z.boolean().optional(),
          }),
        ]),
      ),
    }),
  )
  .min(1);

export function parseSavedCardDescription(
  raw: unknown,
  effects: readonly BattleCardEffect[],
): CardDescription | undefined {
  const parsed = descriptionSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  // Structural validation cannot correlate the discriminator with a referenced
  // field. The renderer also checks every actual effect kind, field and shared value.
  const description = parsed.data as CardDescription;
  try {
    renderCardDescription(effects, description);
    return description;
  } catch {
    return undefined;
  }
}
