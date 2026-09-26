import type { TalentDefinition, TalentEffectOperation } from "./types";
import type { KeywordId } from "../types";

function talent(
  id: string,
  keywordId: KeywordId,
  name: string,
  description: string,
  icon: string,
  ...ops: [TalentEffectOperation, ...TalentEffectOperation[]]
): TalentDefinition {
  return { id, keywordId, name, description, icon, effects: [...ops] };
}

// Each keyword pool repeats its keyword on every row (and must match its
// filename). Presetting it once per file removes the repetition and makes a
// misbucketed row impossible.
export function talentFor(keywordId: KeywordId) {
  return (
    id: string,
    name: string,
    description: string,
    icon: string,
    ...ops: [TalentEffectOperation, ...TalentEffectOperation[]]
  ): TalentDefinition => talent(id, keywordId, name, description, icon, ...ops);
}
