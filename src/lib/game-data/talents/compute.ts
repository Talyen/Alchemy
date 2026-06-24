import type { TalentEffectManifest } from "../talent-effect-manifest";
import { talentPool } from "./pool";
import { isTalentPlaceholder, type TalentEffectOperation, type UnlockedTalents } from "./types";
import { createEmptyTalentEffectManifest } from "./manifest-defaults";

const talentById = new Map(talentPool.map((talent) => [talent.id, talent]));

export function createEmptyTalentManifest(): TalentEffectManifest {
  return createEmptyTalentEffectManifest();
}

// Collapse unlocked IDs into a flat manifest once per change/battle. Combat code reads
// numbers/booleans directly, which keeps turn resolution decoupled from talent grid data.
export function computeTalentEffects(unlockedTalents: UnlockedTalents): TalentEffectManifest {
  const manifest = createEmptyTalentManifest();

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
  // Data-driven talent effects keep descriptions and mechanics adjacent in talentPool.
  if (effect.kind === "add") {
    manifest[effect.field] += effect.amount;
    return;
  }

  setTalentEffect(manifest, effect.field, effect.value);
}

function setTalentEffect<K extends keyof TalentEffectManifest>(
  manifest: TalentEffectManifest,
  field: K,
  value: TalentEffectManifest[K],
) {
  // Centralized assignment keeps the generic reducer type-safe for all manifest field shapes.
  manifest[field] = value;
}
