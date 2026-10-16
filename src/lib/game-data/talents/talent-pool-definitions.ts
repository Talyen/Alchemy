import type { TalentDefinition } from "./types";
import type { KeywordId } from "../types";
import { talentRows } from "./talent-rows";

export const talentPool: TalentDefinition[] = talentRows;

if (new Set(talentPool.map((talent) => talent.id)).size !== talentPool.length) {
  throw new Error("talentPool has duplicate talent ids");
}
export const talentById: ReadonlyMap<string, TalentDefinition> = new Map(
  talentPool.map((talent) => [talent.id, talent]),
);

export function getTalentById(talentId: string): TalentDefinition | undefined {
  return talentById.get(talentId);
}

export const talentPoolByKeyword: ReadonlyMap<KeywordId, TalentDefinition[]> = talentPool.reduce<
  Map<KeywordId, TalentDefinition[]>
>((acc, talent) => {
  const bucket = acc.get(talent.keywordId);
  if (bucket) bucket.push(talent);
  else acc.set(talent.keywordId, [talent]);
  return acc;
}, new Map());

export function getTalentsForKeyword(keywordId: KeywordId): TalentDefinition[] {
  return talentPoolByKeyword.get(keywordId) ?? [];
}
