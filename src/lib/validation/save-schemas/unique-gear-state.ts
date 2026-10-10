import { z } from "zod";
import { BattleCardEffectSchema } from "@/lib/game-data";
import { createUniqueGearBattleState } from "@/lib/battle";
import { recordNestedValidationWarnings } from "./validation-utils";

const echoCardSchema = z.looseObject({
  id: z.string(),
  title: z.string(),
  art: z.string(),
  cost: z.number().nonnegative(),
  descriptionLines: z.array(z.string()),
  effects: z.array(BattleCardEffectSchema),
  tags: z.array(z.string()).optional(),
});

const ready = z.boolean().catch(false);
const cardUid = z.number().int().nonnegative().nullable().catch(null);

export const UniqueGearBattleStateSchema = z
  .object({
    everkeenReady: ready,
    viperReady: ready,
    wildheartReady: ready,
    knightsAnswerReady: ready,
    wrenflightActive: ready,
    wardbreakerPurgeUsed: ready,
    finalSparkUsed: ready,
    lastArcheryUid: cardUid,
    returningFlightUid: cardUid,
    archeryEchoes: z
      .array(z.unknown())
      .transform((entries) =>
        entries.flatMap((entry, index) => {
          const result = echoCardSchema.safeParse(entry);
          if (result.success) return [result.data];
          recordNestedValidationWarnings([
            { path: `uniqueGear.archeryEchoes[${index}]`, message: "malformed Archery echo was dropped" },
          ]);
          return [];
        }),
      )
      .catch([]),
  })
  .catch(() => ({ ...createUniqueGearBattleState(), archeryEchoes: [] }));
