/**
 * Talent definitions, pools, UI filter/sampling helpers, and default manifests.
 * Depends on: src/lib/game-data/types.ts
 * Depended on by: src/lib/talents.ts, homestead, and the battle state machine
 */
import type { KeywordId, TalentEffectManifest } from "../types";

export const TALENTS_CONFIG = {
  PLACEHOLDER_DESCRIPTION: "Placeholder talent (NYI)",
} as const;

// A talent definition — ID, keyword, optional short name for UI tooltips, and
// description (rules text). New talents can be added by simply appending to
// the talentPool array below.
export interface TalentDefinition {
  id: string;
  keywordId: KeywordId;
  name?: string;
  description: string;
  effects?: TalentEffectOperation[];
}

type NumericTalentEffectField = {
  [K in keyof TalentEffectManifest]: TalentEffectManifest[K] extends number ? K : never;
}[keyof TalentEffectManifest];

type TalentEffectSetOperation = {
  [K in keyof TalentEffectManifest]: { kind: "set"; field: K; value: TalentEffectManifest[K] };
}[keyof TalentEffectManifest];

type TalentEffectAddOperation = { kind: "add"; field: NumericTalentEffectField; amount: number };

export type TalentEffectOperation = TalentEffectSetOperation | TalentEffectAddOperation;

export function addEffect(field: NumericTalentEffectField, amount: number): TalentEffectAddOperation {
  // Additive rules let repeated talents stack without duplicating manifest reduction logic.
  return { kind: "add", field, amount };
}

export function setEffect<K extends keyof TalentEffectManifest>(
  field: K,
  value: TalentEffectManifest[K],
): TalentEffectSetOperation {
  // Set rules encode one-off unlocks beside their talent text while preserving field types.
  return { kind: "set", field, value } as TalentEffectSetOperation;
}

export type UnlockedTalents = Partial<Record<KeywordId, string[]>>;

export function placeholderTalents(
  keywordId: KeywordId,
  idPrefix: string,
  start: number,
  end: number,
): TalentDefinition[] {
  return Array.from({ length: end - start + 1 }, (_, index) => {
    return {
      id: `${idPrefix}-${start + index}`,
      keywordId,
      name: `Placeholder ${index + 1}`,
      description: TALENTS_CONFIG.PLACEHOLDER_DESCRIPTION,
    };
  });
}

// The full pool of unlockable talents. Most keywords have 10 talents for a 2x5 or equivalent grid.
