import type { KeywordId } from "@/lib/game-data";
import type { GearAffixId } from "../affix-ids";
import type { GearEffectManifest } from "../gear-effect-manifest";
import type { GearRarity } from "../types";

export type GearAffixAspect = "offensive" | "defensive";

export interface AffixRow {
  id: GearAffixId;
  aspect: GearAffixAspect;
  keywordId: KeywordId;
  secondaryKeywordId?: KeywordId;
  descriptionTemplate: string;
  effectKey: keyof GearEffectManifest;
  basic: { min: number; max: number };
  astral: { min: number; max: number };
}

export interface GearAffixDefinition {
  id: GearAffixId;
  aspect: GearAffixAspect;
  keywordId: KeywordId;
  secondaryKeywordId?: KeywordId;
  descriptionTemplate: string;
  effectKey: keyof GearEffectManifest;
  roll: Record<GearRarity, { min: number; max: number }>;
}
