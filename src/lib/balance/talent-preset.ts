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
import type { TalentPreset } from "./simulator-types";

export const META_ONLY_TALENT_FIELDS: ReadonlySet<keyof TalentEffectManifest> = new Set([
  "shopCardDiscount",
  "shopFreeRefresh",
  "goldPerCombat",
  "companionVictoryGold",
  "potionDiscount",
  "removeCardDiscount",
  "enemyGoldDropBonus",
  "eliteGoldDropBonus",
  "mixPotionDiscount",
  "campfireHealBonus",
  "maxHealthPerCombat",
  "wishGemsGold",
]);

export function isCombatTalent(talent: TalentDefinition): boolean {
  if (isTalentPlaceholder(talent)) return false;
  const effects = talent.effects ?? [];
  if (effects.length === 0) return false;
  return effects.some((effect) => !META_ONLY_TALENT_FIELDS.has(effect.field));
}

export function combatTalentsInPoolOrder(keywordId: TalentDefinition["keywordId"]): TalentDefinition[] {
  return talentPool.filter((talent) => talent.keywordId === keywordId && isCombatTalent(talent));
}

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

const PRESET_MANIFEST_CACHE = new Map<string, TalentEffectManifest>();

export function buildPresetManifest(keywords: readonly KeywordId[], preset: TalentPreset): TalentEffectManifest {
  if (preset === "early") return defaultTalentEffects;
  const key = `${keywords.join(",")}:${preset}`;
  let cached = PRESET_MANIFEST_CACHE.get(key);
  if (!cached) {
    cached = computeTalentEffects(buildPresetUnlockedTalents(keywords, preset));
    PRESET_MANIFEST_CACHE.set(key, cached);
  }
  // The cache template is shared: return a copy so callers can never mutate it.
  return {
    ...cached,
    companionBondLevels: { ...cached.companionBondLevels },
    cardHealBonus: { ...cached.cardHealBonus },
    healthThresholdArmor: [...cached.healthThresholdArmor],
  };
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
