import { defaultTalentEffects } from "@/lib/battle";
import {
  computeTalentEffects,
  getTalentsForKeyword,
  isTalentPlaceholder,
  talentPool,
  type KeywordId,
  type TalentDefinition,
  type TalentEffectManifest,
  type UnlockedTalents,
} from "@/lib/game-data";
import type { TalentPreset } from "./types";

export const LATE_AFFINITY_TALENT_CAP = 7;
export const MID_AFFINITY_TALENT_COUNT = 5;
export const MID_OTHER_TALENT_COUNT = 2;
export const LATE_OTHER_TALENT_COUNT = 5;

const WILDCARD_TALENT_BUDGET: Record<TalentPreset, number> = {
  early: 0,
  mid: MID_AFFINITY_TALENT_COUNT * 3 + MID_OTHER_TALENT_COUNT,
  late: LATE_AFFINITY_TALENT_CAP * 3 + LATE_OTHER_TALENT_COUNT,
};

export function talentsInTreeOrder(keywordId: KeywordId): TalentDefinition[] {
  return getTalentsForKeyword(keywordId).filter((talent) => !isTalentPlaceholder(talent));
}

export function buildPresetUnlockedTalents(keywords: readonly KeywordId[], preset: TalentPreset): UnlockedTalents {
  if (preset === "early") return {};

  const allKeywordIds = [...new Set(talentPool.map((talent) => talent.keywordId))];
  const affinitySet = new Set(keywords);
  const isWildcard = keywords.length === 0;
  const unlockedTalents: UnlockedTalents = {};

  if (isWildcard) {
    let budget = WILDCARD_TALENT_BUDGET[preset];
    for (const keywordId of allKeywordIds) {
      if (budget <= 0) break;
      const treeTalents = talentsInTreeOrder(keywordId);
      const take = Math.min(treeTalents.length, 2, budget);
      if (take <= 0) continue;
      unlockedTalents[keywordId] = treeTalents.slice(0, take).map((talent) => talent.id);
      budget -= take;
    }
    return unlockedTalents;
  }

  for (const keywordId of keywords) {
    const treeTalents = talentsInTreeOrder(keywordId);
    const count = preset === "mid" ? MID_AFFINITY_TALENT_COUNT : Math.min(treeTalents.length, LATE_AFFINITY_TALENT_CAP);
    if (count <= 0) continue;
    unlockedTalents[keywordId] = treeTalents.slice(0, count).map((talent) => talent.id);
  }

  let otherBudget = preset === "mid" ? MID_OTHER_TALENT_COUNT : LATE_OTHER_TALENT_COUNT;
  for (const keywordId of allKeywordIds) {
    if (otherBudget <= 0) break;
    if (affinitySet.has(keywordId)) continue;
    const treeTalents = talentsInTreeOrder(keywordId);
    const take = Math.min(treeTalents.length, otherBudget);
    if (take <= 0) continue;
    unlockedTalents[keywordId] = treeTalents.slice(0, take).map((talent) => talent.id);
    otherBudget -= take;
  }

  return unlockedTalents;
}

export function countUnlockedCombatTalents(keywords: readonly KeywordId[], preset: TalentPreset): number {
  const unlocked = buildPresetUnlockedTalents(keywords, preset);
  return Object.values(unlocked).reduce((total, ids) => total + (ids?.length ?? 0), 0);
}

const AFFINITY_POINT_FALLBACK: Record<TalentPreset, number> = {
  early: 0,
  mid: MID_AFFINITY_TALENT_COUNT * 3,
  late: LATE_AFFINITY_TALENT_CAP * 3,
};

export function countAffinityCombatTalents(keywords: readonly KeywordId[], preset: TalentPreset): number {
  if (keywords.length === 0) {
    return AFFINITY_POINT_FALLBACK[preset];
  }
  const unlocked = buildPresetUnlockedTalents(keywords, preset);
  return keywords.reduce((total, keywordId) => total + (unlocked[keywordId]?.length ?? 0), 0);
}

export function buildPresetManifest(keywords: readonly KeywordId[], preset: TalentPreset): TalentEffectManifest {
  if (preset === "early") return defaultTalentEffects;
  return computeTalentEffects(buildPresetUnlockedTalents(keywords, preset));
}

export function withTalent(unlocked: UnlockedTalents, talent: TalentDefinition): UnlockedTalents {
  const current = unlocked[talent.keywordId] ?? [];
  if (current.includes(talent.id)) return unlocked;
  return { ...unlocked, [talent.keywordId]: [...current, talent.id] };
}

export function withoutTalent(unlocked: UnlockedTalents, talent: TalentDefinition): UnlockedTalents {
  const current = unlocked[talent.keywordId] ?? [];
  const next = current.filter((id) => id !== talent.id);
  if (next.length === current.length) return unlocked;
  return { ...unlocked, [talent.keywordId]: next };
}
