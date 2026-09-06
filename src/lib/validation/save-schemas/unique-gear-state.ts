import { z } from "zod";
import { BattleCardEffectSchema } from "@/lib/game-data";
import { createUniqueGearBattleState } from "@/lib/battle";

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
    spentForge: z.number().int().nonnegative().catch(0),
    viperReady: ready,
    wildheartReady: ready,
    knightsAnswerReady: ready,
    redHarvestUsed: ready,
    redHarvestUid: cardUid,
    huntsmasterUsed: ready,
    wrenflightActive: ready,
    finalSparkUsed: ready,
    freeBurnUsed: ready,
    freeFreezeUsed: ready,
    freeHolyUsed: ready,
    lastArcheryUid: cardUid,
    returningFlightUid: cardUid,
    archeryEchoes: z.array(echoCardSchema).catch([]),
  })
  .catch(() => ({ ...createUniqueGearBattleState(), archeryEchoes: [] }));
