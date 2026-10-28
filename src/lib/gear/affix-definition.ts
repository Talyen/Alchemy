import type { KeywordId } from "@/lib/game-data";
import type { GearRarity } from "./types";

export type GearAffixAspect = "offensive" | "defensive";

export type AffixRollRange = Record<GearRarity, { min: number; max: number }>;

export function rollRange(basicMin: number, basicMax: number, astralMin: number, astralMax: number): AffixRollRange {
  return {
    basic: { min: basicMin, max: basicMax },
    astral: { min: astralMin, max: astralMax },
    unique: { min: astralMin, max: astralMax },
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
  effectKey: string;
  roll: AffixRollRange;
  uniqueOnly?: boolean;
}

// Single description formatter for every consumer (tooltips and the unique
// catalog). Templates may contain more than one {value} placeholder.
export function formatAffixDescription(template: string, value: number): string {
  return template.replaceAll("{value}", String(value));
}

// Named tuples keep identity/affinity separate from mechanics without building
// an intermediate function for every catalog row. Literal IDs and effect keys
// still infer the saved-ID and combat-manifest unions from the catalog.
type AffixIdentity<Id extends string> = [
  id: Id,
  name: string,
  keywordId: KeywordId,
  secondaryKeywordId?: KeywordId | undefined,
];
type AffixMechanics<Effect extends string> = [effectKey: Effect, roll: AffixRollRange, descriptionTemplate: string];
type UniqueMechanics<Effect extends string> = [effectKey: Effect, descriptionTemplate: string, rollValue?: number];

function affixFor(aspect: GearAffixAspect) {
  return <const Id extends string, const Effect extends string>(
    [id, name, keywordId, secondaryKeywordId]: AffixIdentity<Id>,
    [effectKey, roll, descriptionTemplate]: AffixMechanics<Effect>,
  ) => ({
    id,
    name,
    aspect,
    keywordId,
    ...(secondaryKeywordId ? { secondaryKeywordId } : {}),
    effectKey,
    roll,
    descriptionTemplate,
  });
}

export const offensiveAffix = affixFor("offensive");
export const defensiveAffix = affixFor("defensive");

function uniqueAffixFor(aspect: GearAffixAspect) {
  const define = affixFor(aspect);
  return <const Id extends string, const Effect extends string>(
    identity: AffixIdentity<Id>,
    [effectKey, descriptionTemplate, rollValue = 1]: UniqueMechanics<Effect>,
  ) => ({
    ...define(identity, [effectKey, rollRange(rollValue, rollValue, rollValue, rollValue), descriptionTemplate]),
    uniqueOnly: true,
  });
}

export const offensiveUnique = uniqueAffixFor("offensive");
export const defensiveUnique = uniqueAffixFor("defensive");

export function resistAffix<const T extends string, const E extends string>(
  id: T,
  name: string,
  keywordId: KeywordId,
  effectKey: E,
): AffixRowInput & { id: T; effectKey: E } {
  return defensiveAffix(
    [id, name, keywordId],
    [effectKey, ROLL_RESIST, `Reduce ${affixLabel(keywordId)} damage taken by {value}%`],
  );
}

function affixLabel(keywordId: KeywordId): string {
  return keywordId.charAt(0).toUpperCase() + keywordId.slice(1);
}

// "Increases {Keyword} damage by {value}" rows (flat damage bonuses). The
// template derives from the keyword exactly like resistAffix, so new damage
// types cannot drift from the catalog wording.
export function flatDamageAffix<const T extends string, const E extends string>(
  id: T,
  name: string,
  keywordId: KeywordId,
  effectKey: E,
  roll: AffixRollRange = ROLL_SMALL,
  secondaryKeywordId?: KeywordId,
): AffixRowInput & { id: T; effectKey: E } {
  return offensiveAffix(
    [id, name, keywordId, secondaryKeywordId],
    [effectKey, roll, `Increases ${affixLabel(keywordId)} damage by {value}`],
  );
}

// "Gain {value} {Keyword} at the start of combat" rows. Restore/Deal wordings
// (start-heal, start-freeze) stay explicit: the verb is part of their rules.
export function startOfCombatAffix<const T extends string, const E extends string>(
  id: T,
  name: string,
  keywordId: KeywordId,
  effectKey: E,
  roll: AffixRollRange,
  secondaryKeywordId?: KeywordId,
): AffixRowInput & { id: T; effectKey: E } {
  return defensiveAffix(
    [id, name, keywordId, secondaryKeywordId],
    [effectKey, roll, `Gain {value} ${affixLabel(keywordId)} at the start of combat`],
  );
}
