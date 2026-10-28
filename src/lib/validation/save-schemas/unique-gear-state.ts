import { z } from "zod";
import { BattleCardEffectSchema } from "@/lib/game-data";
import { SavedKeywordArraySchema } from "./battle-card-schemas";
import { createUniqueGearBattleState } from "@/lib/battle";
import { parseValidEntries } from "./validation-utils";

const echoCardSchema = z
  .looseObject({
    id: z.string(),
    title: z.string(),
    art: z.string(),
    cost: z.number().nonnegative(),
    descriptionLines: z.array(z.string()),
    effects: z.array(BattleCardEffectSchema),
    tags: SavedKeywordArraySchema.optional().catch(undefined),
  })
  .transform(({ tags, ...card }) => ({ ...card, ...(tags === undefined ? {} : { tags }) }));

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
    returningFlightUids: z
      .array(z.unknown())
      .transform((entries) => parseValidEntries(entries, z.number().int().nonnegative()))
      .catch([]),
    archeryEchoes: z
      .array(z.unknown())
      .transform((entries) =>
        parseValidEntries(entries, echoCardSchema, {
          path: "uniqueGear.archeryEchoes",
          message: "malformed Archery echo was dropped",
        }),
      )
      .catch([]),
  })
  .catch(() => ({ ...createUniqueGearBattleState(), archeryEchoes: [] }));
