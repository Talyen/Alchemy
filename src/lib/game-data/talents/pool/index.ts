// Aggregated talent pool — canonical data lives in `talent-pool-definitions.ts`.
// This barrel exists so existing imports (`@/lib/game-data/talents/pool`) keep working
// and so docs that mention `pool/{keyword}.ts` remain accurate until updated.
// New keywords should be added to `talent-pool-definitions.ts`, not new files.
export { talentPool } from "../talent-pool-definitions";

// Per-keyword re-exports for backward compat (deprecated — prefer `talentPool` + `getTalentsForKeyword`).
import { talentPool } from "../talent-pool-definitions";

const talentPoolByKeyword = talentPool.reduce<Map<string, typeof talentPool>>((acc, talent) => {
  const bucket = acc.get(talent.keywordId);
  if (bucket) bucket.push(talent);
  else acc.set(talent.keywordId, [talent]);
  return acc;
}, new Map());

function getKeywordTalents(keywordId: string) {
  return talentPoolByKeyword.get(keywordId) ?? [];
}

export const physicalTalents = getKeywordTalents("physical");
export const stunTalents = getKeywordTalents("stun");
export const blockTalents = getKeywordTalents("block");
export const forgeTalents = getKeywordTalents("forge");
export const armorTalents = getKeywordTalents("armor");
export const healthTalents = getKeywordTalents("health");
export const burnTalents = getKeywordTalents("burn");
export const goldTalents = getKeywordTalents("gold");
export const holyTalents = getKeywordTalents("holy");
export const wishTalents = getKeywordTalents("wish");
export const poisonTalents = getKeywordTalents("poison");
export const bleedTalents = getKeywordTalents("bleed");
export const leechTalents = getKeywordTalents("leech");
export const freezeTalents = getKeywordTalents("freeze");
export const manaTalents = getKeywordTalents("mana");
export const natureTalents = getKeywordTalents("nature");
export const companionTalents = getKeywordTalents("companion");
export const archeryTalents = getKeywordTalents("archery");
export const consumeTalents = getKeywordTalents("consume");
