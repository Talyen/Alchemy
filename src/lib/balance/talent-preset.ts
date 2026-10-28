import {
  computeTalentEffects,
  createEmptyTalentEffectManifest,
  getTalentsForKeyword,
  talentPool,
  type KeywordId,
  type TalentDefinition,
  type TalentEffectManifest,
  type UnlockedTalents,
} from "@/lib/game-data";
import type { TalentPreset } from "./simulator-types";

const META_ONLY_TALENT_FIELDS: ReadonlySet<keyof TalentEffectManifest> = new Set([
  "shopCardDiscount",
  "shopFreeRefreshChance",
  "companionVictoryGold",
  "potionDiscount",
  "removeCardDiscount",
  "enemyGoldDropBonus",
  "mixPotionDiscount",
  "healthRestorePerCombat",
]);

export function isCombatTalent(talent: TalentDefinition): boolean {
  return Object.keys(talent.effects ?? {}).some(
    (field) => !META_ONLY_TALENT_FIELDS.has(field as keyof TalentEffectManifest),
  );
}

export function combatTalentsInPoolOrder(keywordId: TalentDefinition["keywordId"]): TalentDefinition[] {
  return getTalentsForKeyword(keywordId).filter(isCombatTalent);
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
  return getTalentsForKeyword(keywordId);
}

// Authored catalog order determines how the non-affinity budget is spent.
const ALL_KEYWORD_IDS = [...new Set(talentPool.map((talent) => talent.keywordId))];

export function buildPresetUnlockedTalents(keywords: readonly KeywordId[], preset: TalentPreset): UnlockedTalents {
  if (preset === "early") return {};

  const affinitySet = new Set(keywords);
  const isWildcard = keywords.length === 0;
  const unlockedTalents: UnlockedTalents = {};

  for (const keywordId of keywords) {
    const treeTalents = talentsInTreeOrder(keywordId);
    const count = preset === "mid" ? MID_AFFINITY_TALENT_COUNT : Math.min(treeTalents.length, LATE_AFFINITY_TALENT_CAP);
    if (count <= 0) continue;
    unlockedTalents[keywordId] = treeTalents.slice(0, count).map((talent) => talent.id);
  }

  let otherBudget = isWildcard
    ? WILDCARD_TALENT_BUDGET[preset]
    : preset === "mid"
      ? MID_OTHER_TALENT_COUNT
      : LATE_OTHER_TALENT_COUNT;
  for (const keywordId of ALL_KEYWORD_IDS) {
    if (otherBudget <= 0) break;
    if (affinitySet.has(keywordId)) continue;
    const treeTalents = talentsInTreeOrder(keywordId);
    const take = Math.min(treeTalents.length, otherBudget, isWildcard ? 2 : Infinity);
    if (take <= 0) continue;
    unlockedTalents[keywordId] = treeTalents.slice(0, take).map((talent) => talent.id);
    otherBudget -= take;
  }

  return unlockedTalents;
}

/**
 * Total unlocked talent points in the preset tree for health scaling (1 HP per talent point).
 * Matches computeTotalTalentPoints * MAX_HEALTH_PER_TALENT_POINT in progression.ts.
 */
export function countUnlockedCombatTalents(keywords: readonly KeywordId[], preset: TalentPreset): number {
  const unlocked = buildPresetUnlockedTalents(keywords, preset);
  return Object.values(unlocked).reduce((total, ids) => total + (ids?.length ?? 0), 0);
}

const MAX_CACHED_PRESET_MANIFESTS = 128;
const PRESET_MANIFEST_CACHE = new Map<string, TalentEffectManifest>();

export function buildPresetManifest(keywords: readonly KeywordId[], preset: TalentPreset): TalentEffectManifest {
  if (preset === "early") return createEmptyTalentEffectManifest();
  const key = `${keywords.join(",")}:${preset}`;
  let cached = PRESET_MANIFEST_CACHE.get(key);
  if (!cached) {
    cached = computeTalentEffects(buildPresetUnlockedTalents(keywords, preset));
    if (PRESET_MANIFEST_CACHE.size >= MAX_CACHED_PRESET_MANIFESTS)
      PRESET_MANIFEST_CACHE.delete(PRESET_MANIFEST_CACHE.keys().next().value!);
  } else {
    PRESET_MANIFEST_CACHE.delete(key);
  }
  PRESET_MANIFEST_CACHE.set(key, cached);
  return structuredClone(cached);
}

export function withTalent(unlocked: UnlockedTalents, talent: TalentDefinition): UnlockedTalents {
  const current = unlocked[talent.keywordId] ?? [];
  if (current.includes(talent.id)) return unlocked;
  return { ...unlocked, [talent.keywordId]: [...current, talent.id] };
}

export function withoutTalent(unlocked: UnlockedTalents, talent: TalentDefinition): UnlockedTalents {
  const current = unlocked[talent.keywordId] ?? [];
  if (!current.includes(talent.id)) return unlocked;
  const next = current.filter((id) => id !== talent.id);
  return { ...unlocked, [talent.keywordId]: next };
}
