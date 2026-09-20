import type { TalentDefinition, TalentEffectOperation } from "./types";
import type { KeywordId } from "../types";

export function talent(
  id: string,
  keywordId: KeywordId,
  name: string,
  description: string,
  icon: string,
  ...ops: [TalentEffectOperation, ...TalentEffectOperation[]]
): TalentDefinition {
  return { id, keywordId, name, description, icon, effects: [...ops] };
}
