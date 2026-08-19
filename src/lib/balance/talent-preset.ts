// Combat-filtered talent presets for balance simulations (tree row / pool order).
import { defaultTalentEffects } from "@/lib/battle";
import {
  computeTalentEffects,
  talentPool,
  type KeywordId,
  type TalentDefinition,
  type TalentEffectManifest,
  type UnlockedTalents,
} from "@/lib/game-data";
import { combatTalentsInPoolOrder } from "./combat-talent";
import type { TalentPreset } from "./types";

export const LATE_AFFINITY_TALENT_CAP = 7;
export const MID_AFFINITY_TALENT_COUNT = 5;
export const MID_OTHER_TALENT_COUNT = 2;
export const LATE_OTHER_TALENT_COUNT = 5;

function talentCount(preset: TalentPreset, isAffinity: boolean, combatCount: number): number {
  if (preset === "early") return 0;
  if (preset === "mid") return isAffinity ? MID_AFFINITY_TALENT_COUNT : MID_OTHER_TALENT_COUNT;
  return isAffinity ? Math.min(combatCount, LATE_AFFINITY_TALENT_CAP) : LATE_OTHER_TALENT_COUNT;
}

export function buildPresetUnlockedTalents(keywords: readonly KeywordId[], preset: TalentPreset): UnlockedTalents {
  if (preset === "early") return {};

  const allKeywordIds = [...new Set(talentPool.map((talent) => talent.keywordId))];
  const affinitySet = new Set(keywords);
  const unlockedTalents: UnlockedTalents = {};

  for (const keywordId of allKeywordIds) {
    const combatTalents = combatTalentsInPoolOrder(keywordId);
    const count = talentCount(preset, affinitySet.has(keywordId), combatTalents.length);
    if (count <= 0) continue;
    unlockedTalents[keywordId] = combatTalents.slice(0, count).map((talent) => talent.id);
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

/** Points a typical player would have spent on this class kit (affinity trees only). */
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
