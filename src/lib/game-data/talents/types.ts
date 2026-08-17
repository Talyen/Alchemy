/**
 * Talent definitions, pools, UI filter/sampling helpers, and default manifests.
 * Depends on: src/lib/game-data/types.ts
 * Depended on by: src/lib/game-data/talents.ts, homestead, and the battle state machine
 */
import type { LucideIcon } from "lucide-react";
import type { KeywordId } from "../types";
import type { TalentEffectManifest } from "../talent-effect-manifest";

// A talent definition — ID, keyword, optional short name for UI tooltips, and
// description (rules text). Pool entries live in talents/pool/{keyword}.ts.
export interface TalentDefinition {
  id: string;
  keywordId: KeywordId;
  name?: string;
  description: string;
  icon?: LucideIcon;
  effects?: TalentEffectOperation[];
  /** NYI pool slots — excluded from unlock choices and spendable point caps. */
  isPlaceholder?: boolean;
}

export function isTalentPlaceholder(talent: TalentDefinition): boolean {
  return talent.isPlaceholder === true;
}

type NumericTalentEffectField = {
  [K in keyof TalentEffectManifest]: TalentEffectManifest[K] extends number ? K : never;
}[keyof TalentEffectManifest];

type TalentEffectSetOperation = {
  [K in keyof TalentEffectManifest]: { kind: "set"; field: K; value: TalentEffectManifest[K] };
}[keyof TalentEffectManifest];

interface TalentEffectAddOperation {
  kind: "add";
  field: NumericTalentEffectField;
  amount: number;
}

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
