import type { TalentEffectManifest } from "../talent-effect-manifest";
import type { KeywordId } from "../types";
import { getTalentById } from "./talent-pool-definitions";
import { isUsableTalentForKeyword, type TalentDefinition, type UnlockedTalents } from "./types";
import { isAdditiveBonus, type TalentBonus } from "./talent-builder";
import { createEmptyTalentEffectManifest } from "./manifest-defaults";

function* usableUnlockedTalents(unlockedTalents: UnlockedTalents): Iterable<TalentDefinition> {
  for (const keywordId of Object.keys(unlockedTalents) as KeywordId[]) {
    const talentIds = unlockedTalents[keywordId];
    if (!talentIds?.length) continue;
    const uniqueIds = talentIds.length === 1 ? talentIds : new Set(talentIds);
    for (const talentId of uniqueIds) {
      const talent = getTalentById(talentId);
      if (isUsableTalentForKeyword(talent, keywordId)) yield talent;
    }
  }
}

export function computeTalentEffects(unlockedTalents: UnlockedTalents): TalentEffectManifest {
  const manifest = createEmptyTalentEffectManifest();

  for (const talent of usableUnlockedTalents(unlockedTalents)) {
    const effects = talent.effects;
    if (!effects) continue;
    for (const field of Object.keys(effects) as Array<keyof TalentEffectManifest>) {
      applyTalentBonus(manifest, field, effects[field]!);
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
  // The catalog supplies the field/value pairing; this owner writes dynamic keys.
  const writable = manifest as Record<keyof TalentEffectManifest, unknown>;
  if (isAdditiveBonus(bonus)) {
    writable[field] = (manifest[field] as number) + bonus.amount;
    return;
  }
  const current = manifest[field];
  // Catalog payloads outlive battles; each manifest owns its mutable values.
  const value = typeof bonus === "object" ? structuredClone(bonus) : bonus;
  if (Array.isArray(current) && Array.isArray(value)) current.push(...value);
  else writable[field] = value;
}
