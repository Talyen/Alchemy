import type { GearAffixId } from "./affix-ids";
import type { AffixRow, GearAffixDefinition } from "./affix-catalog/types";
import { affixrows1 } from "./affix-catalog/affix-rows-1";
import { affixrows2 } from "./affix-catalog/affix-rows-2";
import { affixrows3 } from "./affix-catalog/affix-rows-3";
import { affixrows4 } from "./affix-catalog/affix-rows-4";

export type { GearAffixAspect, GearAffixDefinition } from "./affix-catalog/types";

const affixRows: readonly AffixRow[] = [affixrows1, affixrows2, affixrows3, affixrows4].flat();

export const gearAffixCatalog: Record<GearAffixId, GearAffixDefinition> = Object.fromEntries(
  affixRows.map((row) => [
    row.id,
    {
      id: row.id,
      aspect: row.aspect,
      keywordId: row.keywordId,
      ...(row.secondaryKeywordId !== undefined ? { secondaryKeywordId: row.secondaryKeywordId } : {}),
      descriptionTemplate: row.descriptionTemplate,
      effectKey: row.effectKey,
      roll: { basic: row.basic, astral: row.astral },
    },
  ]),
) as Record<GearAffixId, GearAffixDefinition>;

export const gearAffixList = Object.values(gearAffixCatalog);
