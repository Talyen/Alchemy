import type { TalentEffectManifest } from "../talent-effect-manifest";
import type { KeywordId } from "../types";
import { getTalentById } from "./talent-pool-definitions";
import {
  isUsableTalentForKeyword,
  type TalentDefinition,
  type TalentEffectOperation,
  type UnlockedTalents,
} from "./types";
import { createEmptyTalentEffectManifest } from "./manifest-defaults";

function* usableUnlockedTalents(unlockedTalents: UnlockedTalents): Iterable<TalentDefinition> {
  for (const [keywordId, talentIds] of Object.entries(unlockedTalents)) {
    for (const talentId of talentIds ?? []) {
      const talent = getTalentById(talentId);
      if (isUsableTalentForKeyword(talent, keywordId as KeywordId)) yield talent;
    }
  }
}

export function computeTalentEffects(unlockedTalents: UnlockedTalents): TalentEffectManifest {
  const manifest = createEmptyTalentEffectManifest();

  for (const talent of usableUnlockedTalents(unlockedTalents)) {
    for (const effect of talent.effects ?? []) {
      applyTalentEffect(manifest, effect);
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

function applyTalentEffect(manifest: TalentEffectManifest, effect: TalentEffectOperation) {
  if (effect.kind === "add") {
    manifest[effect.field] += effect.amount;
    return;
  }

  const current = manifest[effect.field];
  if (Array.isArray(current) && Array.isArray(effect.value)) {
    Object.assign(manifest, { [effect.field]: [...current, ...effect.value] });
    return;
  }

  Object.assign(manifest, { [effect.field]: effect.value });
}
