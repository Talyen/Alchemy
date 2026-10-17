import type { TalentEffectManifest } from "../talent-effect-manifest";
import type { KeywordId } from "../types";
import { getTalentById } from "./talent-pool-definitions";
import { isUsableTalentForKeyword, type TalentDefinition, type UnlockedTalents } from "./types";
import { isAdditiveBonus, type TalentBonus } from "./talent-builder";
import { createEmptyTalentEffectManifest } from "./manifest-defaults";

function* usableUnlockedTalents(unlockedTalents: UnlockedTalents): Iterable<TalentDefinition> {
  for (const [keywordId, talentIds] of Object.entries(unlockedTalents)) {
    for (const talentId of new Set(talentIds ?? [])) {
      const talent = getTalentById(talentId);
      if (isUsableTalentForKeyword(talent, keywordId as KeywordId)) yield talent;
    }
  }
}

export function computeTalentEffects(unlockedTalents: UnlockedTalents): TalentEffectManifest {
  const manifest = createEmptyTalentEffectManifest();

  for (const talent of usableUnlockedTalents(unlockedTalents)) {
    for (const [field, value] of Object.entries(talent.effects ?? {})) {
      applyTalentBonus(manifest, field as keyof TalentEffectManifest, value);
    }
  }

  return manifest;
}

export function normalizeUnlockedTalents(unlockedTalents: UnlockedTalents): UnlockedTalents {
  const normalized: UnlockedTalents = {};

  for (const talent of usableUnlockedTalents(unlockedTalents)) {
    (normalized[talent.keywordId] ??= []).push(talent.id);
  }

  return normalized;
}

function applyTalentBonus(manifest: TalentEffectManifest, field: keyof TalentEffectManifest, bonus: TalentBonus) {
  if (isAdditiveBonus(bonus)) {
    Object.assign(manifest, { [field]: (manifest[field] as number) + bonus.amount });
    return;
  }
  const current = manifest[field];
  // Catalog payloads outlive battles; each manifest owns its mutable values.
  const value = typeof bonus === "object" ? structuredClone(bonus) : bonus;
  Object.assign(manifest, {
    [field]: Array.isArray(current) && Array.isArray(value) ? [...current, ...value] : value,
  });
}
