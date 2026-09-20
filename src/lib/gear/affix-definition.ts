import type { KeywordId } from "@/lib/game-data";
import type { GearEffectManifest } from "./gear-effect-manifest";
import type { GearRarity } from "./types";

export type GearAffixAspect = "offensive" | "defensive";

type AffixRollRange = Record<GearRarity, { min: number; max: number }>;

export function rollRange(basicMin: number, basicMax: number, astralMin: number, astralMax: number): AffixRollRange {
  return {
    basic: { min: basicMin, max: basicMax },
    astral: { min: astralMin, max: astralMax },
    unique: { min: astralMin, max: astralMax },
  };
}

function uniqueRoll(value: number): AffixRollRange {
  return {
    basic: { min: value, max: value },
    astral: { min: value, max: value },
    unique: { min: value, max: value },
  };
}

export const ROLL_SMALL = rollRange(1, 2, 3, 4);
const ROLL_RESIST = rollRange(10, 15, 15, 20);
// Percent-based bonuses share the resist numbers today but tune independently:
// retuning resists must never silently retune the economy.
export const ROLL_PERCENT = rollRange(10, 15, 15, 20);
export const ROLL_MEDIUM = rollRange(3, 4, 5, 6);

export interface AffixRowInput {
  id: string;
  name: string;
  aspect: GearAffixAspect;
  keywordId: KeywordId;
  secondaryKeywordId?: KeywordId;
  descriptionTemplate: string;
  effectKey: keyof GearEffectManifest;
  roll: AffixRollRange;
  uniqueOnly?: boolean;
}

// Single description formatter for every consumer (tooltips and the unique
// catalog). Templates may contain more than one {value} placeholder.
export function formatAffixDescription(template: string, value: number): string {
  return template.replaceAll("{value}", String(value));
}

export function uniqueAffix<const T extends string>(
  id: T,
  name: string,
  aspect: GearAffixAspect,
  keywordId: KeywordId,
  descriptionTemplate: string,
  effectKey: keyof GearEffectManifest,
  secondaryKeywordId?: KeywordId,
  rollValue = 1,
): AffixRowInput & { id: T } {
  return {
    id,
    name,
    aspect,
    keywordId,
    ...(secondaryKeywordId ? { secondaryKeywordId } : {}),
    descriptionTemplate,
    effectKey,
    roll: uniqueRoll(rollValue),
    uniqueOnly: true,
  };
}

export function resistAffix<const T extends string>(
  id: T,
  name: string,
  keywordId: KeywordId,
  effectKey: keyof GearEffectManifest,
): AffixRowInput & { id: T } {
  const label = keywordId.charAt(0).toUpperCase() + keywordId.slice(1);
  return {
    id,
    name,
    aspect: "defensive",
    keywordId,
    descriptionTemplate: `Reduce ${label} damage taken by {value}%`,
    effectKey,
    roll: ROLL_RESIST,
  };
}
