import type { KeywordId } from "../types";
import type { TalentEffectManifest } from "../talent-effect-manifest";

export interface TalentDefinition {
  id: string;
  keywordId: KeywordId;
  name?: string;
  description: string;

  icon?: string;
  effects?: TalentEffectOperation[];

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
  return { kind: "add", field, amount };
}

export function setEffect<K extends keyof TalentEffectManifest>(
  field: K,
  value: TalentEffectManifest[K],
): TalentEffectSetOperation {
  return { kind: "set", field, value } as TalentEffectSetOperation;
}

export type UnlockedTalents = Partial<Record<KeywordId, string[]>>;
