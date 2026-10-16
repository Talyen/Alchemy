import type { AdditiveTalentBonus } from "./talent-builder";
import type { KeywordId } from "../types";
import type { TalentEffectManifest } from "../talent-effect-manifest";

export interface TalentDefinition {
  id: string;
  keywordId: KeywordId;
  name?: string;
  description: string;

  icon?: string;
  effects?: Partial<{
    [K in keyof TalentEffectManifest]:
      | TalentEffectManifest[K]
      | (TalentEffectManifest[K] extends number ? AdditiveTalentBonus : never);
  }>;

  isPlaceholder?: boolean;
}

export function isTalentPlaceholder(talent: TalentDefinition): boolean {
  return talent.isPlaceholder === true;
}

export function isUsableTalentForKeyword(
  talent: TalentDefinition | undefined,
  keywordId: KeywordId,
): talent is TalentDefinition {
  return !!talent && !isTalentPlaceholder(talent) && talent.keywordId === keywordId;
}

export type UnlockedTalents = Partial<Record<KeywordId, string[]>>;
