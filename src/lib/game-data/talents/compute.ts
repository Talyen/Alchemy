import type { TalentEffectManifest } from "../talent-effect-manifest";
import { talentPool } from "./pool";
import { isTalentPlaceholder, type TalentEffectOperation, type UnlockedTalents } from "./types";
import { createEmptyTalentEffectManifest } from "./manifest-defaults";

const talentById = new Map(talentPool.map((talent) => [talent.id, talent]));

export function computeTalentEffects(unlockedTalents: UnlockedTalents): TalentEffectManifest {
  const manifest = createEmptyTalentEffectManifest();

  for (const [keywordId, talentIds] of Object.entries(unlockedTalents)) {
    for (const talentId of talentIds ?? []) {
      const talent = talentById.get(talentId);
      if (!talent || isTalentPlaceholder(talent) || talent.keywordId !== keywordId) continue;
      for (const effect of talent.effects ?? []) {
        applyTalentEffect(manifest, effect);
      }
    }
  }

  return manifest;
}

export function normalizeUnlockedTalents(unlockedTalents: UnlockedTalents): UnlockedTalents {
  const normalized: UnlockedTalents = {};

  for (const [keywordId, talentIds] of Object.entries(unlockedTalents)) {
    const validIds = [];
    for (const talentId of talentIds ?? []) {
      const talent = talentById.get(talentId);
      if (!talent || isTalentPlaceholder(talent) || talent.keywordId !== keywordId) continue;
      validIds.push(talentId);
    }
    if (validIds.length > 0) {
      normalized[keywordId as keyof UnlockedTalents] = validIds;
    }
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
