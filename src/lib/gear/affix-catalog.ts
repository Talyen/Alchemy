import type { AffixRowInput } from "./affix-definition";
export { formatAffixDescription, type GearAffixAspect } from "./affix-definition";
import { gearAffixRows as affixRows, type GearAffixId, type GearAffixEffectKey } from "./affix-rows";
export type { GearAffixId } from "./affix-rows";

import { extractKeywordIds } from "@/lib/keyword-text";
import type { KeywordId } from "@/lib/game-data";

export interface GearAffixDefinition extends AffixRowInput {
  id: GearAffixId;
  effectKey: GearAffixEffectKey;
  visibleKeywordIds: readonly KeywordId[];
}

export const GEAR_AFFIX_IDS = affixRows.map((row) => row.id) as [GearAffixId, ...GearAffixId[]];

export const gearAffixCatalog: Record<GearAffixId, GearAffixDefinition> = Object.fromEntries(
  affixRows.map((row) => [
    row.id,
    {
      ...row,
      visibleKeywordIds: Object.freeze(extractKeywordIds(row.descriptionTemplate)),
    },
  ]),
) as Record<GearAffixId, GearAffixDefinition>;

// Object.fromEntries silently overwrites duplicate ids, so fail fast here
// instead of shipping a catalog that lost a row.
if (affixRows.length !== new Set(affixRows.map((row) => row.id)).size) {
  throw new Error("gearAffixCatalog has duplicate affix ids");
}

export const gearAffixList = Object.values(gearAffixCatalog);
