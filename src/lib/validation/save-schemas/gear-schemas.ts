import { z } from "zod";
import { GEAR_AFFIX_IDS } from "@/lib/gear/affix-catalog";
import { GEAR_DEFINITION_IDS } from "@/lib/gear/definitions";
import { normalizeGearInstance } from "@/lib/gear/operations";
import { migrateLegacyGearInstance } from "../migration/migrate-gear";

const GearAffixRollSchema = z.object({
  id: z.enum(GEAR_AFFIX_IDS),
  value: z.number().int().positive(),
});

export const GearInstanceSchema = z.object({
  instanceId: z.string().min(1),
  definitionId: z.enum(GEAR_DEFINITION_IDS),
  affixes: z.array(GearAffixRollSchema),
});

export function normalizeGearInstanceArray(raw: unknown): Array<z.infer<typeof GearInstanceSchema>> {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const migrated = migrateLegacyGearInstance(item);
    const normalized = normalizeGearInstance(migrated);
    return normalized ? [normalized] : [];
  });
}

export const GearInstanceArraySchema = z.preprocess(
  (raw) => normalizeGearInstanceArray(raw),
  z.array(GearInstanceSchema),
);
