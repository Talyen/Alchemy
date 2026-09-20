import type { TalentDefinition } from "./types";
import type { KeywordId } from "../types";
import { dodgeTalents } from "./pools/dodge";
import { archeryTalents } from "./pools/archery";
import { armorTalents } from "./pools/armor";
import { bleedTalents } from "./pools/bleed";
import { blockTalents } from "./pools/block";
import { burnTalents } from "./pools/burn";
import { companionTalents } from "./pools/companion";
import { consumeTalents } from "./pools/consume";
import { forgeTalents } from "./pools/forge";
import { freezeTalents } from "./pools/freeze";
import { goldTalents } from "./pools/gold";
import { healthTalents } from "./pools/health";
import { holyTalents } from "./pools/holy";
import { leechTalents } from "./pools/leech";
import { manaTalents } from "./pools/mana";
import { natureTalents } from "./pools/nature";
import { physicalTalents } from "./pools/physical";
import { poisonTalents } from "./pools/poison";
import { stunTalents } from "./pools/stun";
import { wishTalents } from "./pools/wish";

// Preserve catalog order: seeded offers depend on it.
export const talentPool: TalentDefinition[] = [
  ...dodgeTalents,
  ...archeryTalents,
  ...armorTalents,
  ...bleedTalents,
  ...blockTalents,
  ...burnTalents,
  ...companionTalents,
  ...consumeTalents,
  ...forgeTalents,
  ...freezeTalents,
  ...goldTalents,
  ...healthTalents,
  ...holyTalents,
  ...leechTalents,
  ...manaTalents,
  ...natureTalents,
  ...physicalTalents,
  ...poisonTalents,
  ...stunTalents,
  ...wishTalents,
];

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
